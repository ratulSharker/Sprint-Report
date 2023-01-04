require('dotenv').config();
const csv = require("csvtojson");
const moment = require("moment");

async function readCSVAsJson(inputCsvFilePath) {
	return await csv().fromFile(inputCsvFilePath);
}

const csvRowFilters = {
	assigneeIsNotEmpty: (assigneeFieldName) => {
		return (row) => {
			const assignee = row[assigneeFieldName];
			return assignee != "";
		};
	},
	equalSprintName: (sprintFieldName, sprintName) => {
		return (row) => {
			const sprint = row[sprintFieldName];
			return sprint == sprintName;
		};
	},
	testedByNotEmpty: (testedByFieldName) => {
		return (row) => {
			const testedBy = row[testedByFieldName];
			return testedBy != "";
		};
	},
	testedByEmpty: (testedByFieldName) => {
		return (row) => {
			const testedBy = row[testedByFieldName];
			return testedBy == "";
		};
	},
	statusEqual: (statusFieldName, statusName) => {
		return (row) => {
			const status = row[statusFieldName];
			return status == statusName;
		};
	},
	statusNotEqual: (statusFieldName, statusName) => {
		return (row) => {
			const status = row[statusFieldName];
			return status != statusName;
		};
	},
	updatedBetween: (updatedFieldName, startMomentDate, endMomentDate) => {
		return (row) => {
			const updated = moment(row[updatedFieldName], "DD/MMM/YY");
			return updated.isSameOrAfter(startMomentDate) && updated.isSameOrBefore(endMomentDate);
		}
	}
}

function prepareReportDataForPerAssigneePerStatusIssueCount(csvRows, sprintName, assigneeFieldName, statusFieldName, sprintFieldName, updatedFieldName, sprintStartMomentDate, sprintEndMomentDate) {
	const perAssigneePerStatusIssueCount = {};
	const totalKey = "Total";
	csvRows
		.filter(csvRowFilters.updatedBetween(updatedFieldName, sprintStartMomentDate, sprintEndMomentDate))
		.filter(csvRowFilters.assigneeIsNotEmpty(assigneeFieldName))
		.forEach(csvRow => {
			const assignee = csvRow[assigneeFieldName];
			const status = csvRow[statusFieldName];

			const statusWiseIssueCount = perAssigneePerStatusIssueCount[assignee] || {};
			const issueCount = statusWiseIssueCount[status] ? statusWiseIssueCount[status] + 1 : 1;
			const totalCount = statusWiseIssueCount[totalKey] ? statusWiseIssueCount[totalKey] + 1 : 1;

			statusWiseIssueCount[status] = issueCount;
			statusWiseIssueCount[totalKey] = totalCount;
			perAssigneePerStatusIssueCount[assignee] = statusWiseIssueCount;
		});

	return perAssigneePerStatusIssueCount;
}

function prepareReportDataForPerAssigneePerStatusStoryPoints(csvRows, sprintName, assigneeFieldName, statusFieldName, sprintFieldName, storyPointFieldName, updatedFieldName, sprintStartMomentDate, sprintEndMomentDate) {
	let perAssigneePerStatusStoryPoints = {};
	const totalKey = "Total";
	csvRows
		.filter(csvRowFilters.updatedBetween(updatedFieldName, sprintStartMomentDate, sprintEndMomentDate))
		.filter(csvRowFilters.assigneeIsNotEmpty(assigneeFieldName))
		.forEach(csvRow => {
			const assignee = csvRow[assigneeFieldName];
			const status = csvRow[statusFieldName];
			let storyPoint = parseFloat(csvRow[storyPointFieldName]);
			storyPoint = isNaN(storyPoint) ? 0 : storyPoint;
	
			const statusWiseStoryPoints = perAssigneePerStatusStoryPoints[assignee] || {};
			const storyPoints = statusWiseStoryPoints[status] != undefined ? statusWiseStoryPoints[status] + storyPoint : storyPoint;
			const totalPoints = statusWiseStoryPoints[totalKey] != undefined ? statusWiseStoryPoints[totalKey] + storyPoint : storyPoint;
	
			statusWiseStoryPoints[status] = storyPoints;
			statusWiseStoryPoints[totalKey] = totalPoints;
			perAssigneePerStatusStoryPoints[assignee] = statusWiseStoryPoints;
		});

	return perAssigneePerStatusStoryPoints;
}

function preparePerTestedByIssueNotInReadyToQA(csvRows, testedByFieldName, statusFieldName, updatedFieldName, sprintStartMomentDate, sprintEndMomentDate) {
	const perTestedByNotInReadyToQAIssueCount = {};

	csvRows
		.filter(csvRowFilters.updatedBetween(updatedFieldName, sprintStartMomentDate, sprintEndMomentDate))
		.filter(csvRowFilters.testedByNotEmpty(testedByFieldName))
		.filter(csvRowFilters.statusNotEqual(statusFieldName, "Ready To QA"))
		.forEach(csvRow => {
			const testedBy = csvRow[testedByFieldName];

			let testedByIssueCount = perTestedByNotInReadyToQAIssueCount[testedBy] || 0;
			testedByIssueCount += 1;

			perTestedByNotInReadyToQAIssueCount[testedBy] = testedByIssueCount;
		});

	return perTestedByNotInReadyToQAIssueCount;
}

function prepareIssueCountAndStoryPointsInGivenStatusName(csvRows, statusFieldName, storyPointFieldName, statusName, updatedFieldName, sprintStartMomentDate, sprintEndMomentDate) {
	let issueCount = 0;
	let storyPoints = 0.0;

	csvRows
		.filter(csvRowFilters.updatedBetween(updatedFieldName, sprintStartMomentDate, sprintEndMomentDate))
		.filter(csvRowFilters.statusEqual(statusFieldName, statusName))
		.forEach(csvRow => {
			issueCount++;

			const storyPoint = parseFloat(csvRow[storyPointFieldName]);
			if (isNaN(storyPoint) == false) {
				storyPoints += storyPoint;
			}
		});

	return {
		"issueCount": issueCount,
		"storyPoints": storyPoints
	};
}

function prepareIssueCountTestedByNoneAndStatusIsDone(csvRows, statusFieldName, testedByFieldName, updatedFieldName, sprintStartMomentDate, sprintEndMomentDate) {
	let issueCount = 0;

	csvRows
		.filter(csvRowFilters.updatedBetween(updatedFieldName, sprintStartMomentDate, sprintEndMomentDate))
		.filter(csvRowFilters.testedByEmpty(testedByFieldName))
		.filter(csvRowFilters.statusEqual(statusFieldName, "Done"))
		.forEach(row => {
			issueCount++;
		});

	return issueCount;
}

async function readCSVAndGenerateReport() {

	const csvRows = await readCSVAsJson(process.env.INPUT_CSV_FILE_NAME);
	const sprintStatuses = process.env.SPRINT_STATUSES.split(",");

	const sprintStartMomentDate = moment(process.env.SPRINT_START_DATE, "DD/MM/YYYY");
	const sprintEndMomentDate = moment(process.env.SPRINT_END_DATE, "DD/MM/YYYY");

	const perAssigneePerStatusIssueCount = prepareReportDataForPerAssigneePerStatusIssueCount(csvRows, process.env.CURRENT_SPRINT, process.env.ASSIGNEE_FIELD_NAME, process.env.STATUS_FIELD_NAME, process.env.SPRINT_FIELD_NAME, process.env.UPDATED_FIELD_NAME, sprintStartMomentDate, sprintEndMomentDate);
	console.log(perAssigneePerStatusIssueCount);

	const perAssigneePerStatusStoryPoints = prepareReportDataForPerAssigneePerStatusStoryPoints(csvRows, process.env.CURRENT_SPRINT, process.env.ASSIGNEE_FIELD_NAME, process.env.STATUS_FIELD_NAME, process.env.SPRINT_FIELD_NAME, process.env.STORY_POINT_FIELD_NAME, process.env.UPDATED_FIELD_NAME, sprintStartMomentDate, sprintEndMomentDate);
	console.log(perAssigneePerStatusStoryPoints);

	const perTestedByIssueNotInReadyToQA = preparePerTestedByIssueNotInReadyToQA(csvRows, process.env.TESTED_BY_FIELD_NAME, process.env.STATUS_FIELD_NAME, process.env.UPDATED_FIELD_NAME, sprintStartMomentDate, sprintEndMomentDate);
	console.log(perTestedByIssueNotInReadyToQA);

	const issueCountAndStoryPointsInReadyToQA = prepareIssueCountAndStoryPointsInGivenStatusName(csvRows, process.env.STATUS_FIELD_NAME, process.env.STORY_POINT_FIELD_NAME, "Ready To QA", process.env.UPDATED_FIELD_NAME, sprintStartMomentDate, sprintEndMomentDate);
	console.log(issueCountAndStoryPointsInReadyToQA);

	const issueCountAndStoryPointsInDone = prepareIssueCountAndStoryPointsInGivenStatusName(csvRows, process.env.STATUS_FIELD_NAME, process.env.STORY_POINT_FIELD_NAME, "Done", process.env.UPDATED_FIELD_NAME, sprintStartMomentDate, sprintEndMomentDate);
	console.log(issueCountAndStoryPointsInDone);

	const issueCountAndStoryPointsInBacklog = prepareIssueCountAndStoryPointsInGivenStatusName(csvRows, process.env.STATUS_FIELD_NAME, process.env.STORY_POINT_FIELD_NAME, "Backlog", process.env.UPDATED_FIELD_NAME, sprintStartMomentDate, sprintEndMomentDate);
	console.log(issueCountAndStoryPointsInBacklog);

	const directlyMadeDoneIssueCount = prepareIssueCountTestedByNoneAndStatusIsDone(csvRows, process.env.STATUS_FIELD_NAME, process.env.TESTED_BY_FIELD_NAME, process.env.UPDATED_FIELD_NAME, sprintStartMomentDate, sprintEndMomentDate);
	console.log(directlyMadeDoneIssueCount);
}

readCSVAndGenerateReport();