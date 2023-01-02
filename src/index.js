require('dotenv').config();
const csv = require("csvtojson");


async function readCSVAsJson(inputCsvFilePath) {
	return await csv().fromFile(inputCsvFilePath);
}

const csvRowFilters = {
	assigneeIsNotEmpty : (assigneeFieldName) => {
		return (row) => {
			const assignee = row[assigneeFieldName];
			return assignee != "";
		};
	},
	equalSprintName : (sprintFieldName, sprintName) => {
		return (row) => {
			const sprint = row[sprintFieldName];
			return sprint == sprintName;
		};
	},
	testedByNotEmpty : (testedByFieldName) => {
		return (row) => {
			const testedBy = row[testedByFieldName];
			return testedBy != "";
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
	}
}

function prepareReportDataForPerAssigneePerStatusIssueCount(csvRows, sprintName, assigneeFieldName, statusFieldName, sprintFieldName) {
	const perAssigneePerStatusIssueCount = {};
	csvRows.filter(csvRowFilters.equalSprintName(sprintFieldName, sprintName))
	.filter(csvRowFilters.assigneeIsNotEmpty(assigneeFieldName))
	.forEach(csvRow => {
		const assignee = csvRow[assigneeFieldName];
		const status = csvRow[statusFieldName];

		const statusWiseIssueCount = perAssigneePerStatusIssueCount[assignee] || {};
		const issueCount = statusWiseIssueCount[status] ? statusWiseIssueCount[status] + 1 : 1;
		
		statusWiseIssueCount[status] = issueCount;
		perAssigneePerStatusIssueCount[assignee] = statusWiseIssueCount;
	});

	return perAssigneePerStatusIssueCount;
}

function prepareReportDataForPerAssigneePerStatusStoryPoints(csvRows, sprintName, assigneeFieldName, statusFieldName, sprintFieldName, storyPointFieldName) {
	const perAssigneePerStatusStoryPoints = {};
	csvRows.filter(csvRowFilters.equalSprintName(sprintFieldName, sprintName))
	.filter(csvRowFilters.assigneeIsNotEmpty(assigneeFieldName))
	.forEach(csvRow => {
		const assignee = csvRow[assigneeFieldName];
		const status = csvRow[statusFieldName];
		let storyPoint = parseFloat(csvRow[storyPointFieldName]);
		storyPoint = isNaN(storyPoint) ? 0 : storyPoint;

		const statusWiseStoryPoints = perAssigneePerStatusStoryPoints[assignee] || {};
		const storyPoints = statusWiseStoryPoints[status] != undefined ? statusWiseStoryPoints[status] + storyPoint : 0;

		statusWiseStoryPoints[status] = storyPoints;
		perAssigneePerStatusStoryPoints[assignee] = statusWiseStoryPoints;
	});

	return perAssigneePerStatusStoryPoints;
}

function preparePerTestedByIssueNotInReadyToQA(csvRows, testedByFieldName, statusFieldName) {
	const perTestedByNotInReadyToQAIssueCount = {};

	csvRows.filter(csvRowFilters.testedByNotEmpty(testedByFieldName))
	.filter(csvRowFilters.statusNotEqual(statusFieldName, "Ready to QA"))
	.forEach(csvRow => {
		const testedBy = csvRow[testedByFieldName];

		let testedByIssueCount = perTestedByNotInReadyToQAIssueCount[testedBy] || 0;
		testedByIssueCount += 1;

		perTestedByNotInReadyToQAIssueCount[testedBy] = testedByIssueCount;
	});

	return perTestedByNotInReadyToQAIssueCount;
}

function prepareIssueCountAndStoryPointsInGivenStatusName(csvRows, statusFieldName, storyPointFieldName, statusName) {
	let issueCount = 0;
	let storyPoints = 0.0;

	csvRows.filter(csvRowFilters.statusEqual(statusFieldName, statusName))
	.forEach(csvRow => {
		issueCount++;

		const storyPoint = parseFloat(csvRow[storyPointFieldName]);
		if(isNaN(storyPoint) == false) {
			storyPoints += storyPoint;
		}
	});

	return {
		"issueCount" : issueCount,
		"storyPoints" : storyPoints
	};
}

async function readCSVAndGenerateReport() {

	const csvRows = await readCSVAsJson(process.env.INPUT_CSV_FILE_NAME);

	const perAssigneePerStatusIssueCount = prepareReportDataForPerAssigneePerStatusIssueCount(csvRows, process.env.CURRENT_SPRINT, process.env.ASSIGNEE_FIELD_NAME, process.env.STATUS_FIELD_NAME, process.env.SPRINT_FIELD_NAME);
	console.log(perAssigneePerStatusIssueCount);

	const perAssigneePerStatusStoryPoints = prepareReportDataForPerAssigneePerStatusStoryPoints(csvRows, process.env.CURRENT_SPRINT, process.env.ASSIGNEE_FIELD_NAME, process.env.STATUS_FIELD_NAME, process.env.SPRINT_FIELD_NAME, process.env.STORY_POINT_FIELD_NAME);
	console.log(perAssigneePerStatusStoryPoints);

	const perTestedByIssueNotInReadyToQA = preparePerTestedByIssueNotInReadyToQA(csvRows, process.env.TESTED_BY_FIELD_NAME, process.env.STATUS_FIELD_NAME);
	console.log(perTestedByIssueNotInReadyToQA);

	const issueCountAndStoryPointsInReadyToQA = prepareIssueCountAndStoryPointsInGivenStatusName(csvRows, process.env.STATUS_FIELD_NAME, process.env.STORY_POINT_FIELD_NAME, "Ready To QA");
	console.log(issueCountAndStoryPointsInReadyToQA);

	const issueCountAndStoryPointsInDone = prepareIssueCountAndStoryPointsInGivenStatusName(csvRows, process.env.STATUS_FIELD_NAME, process.env.STORY_POINT_FIELD_NAME, "Done");
	console.log(issueCountAndStoryPointsInDone);

	const issueCountAndStoryPointsInBacklog = prepareIssueCountAndStoryPointsInGivenStatusName(csvRows, process.env.STATUS_FIELD_NAME, process.env.STORY_POINT_FIELD_NAME, "Backlog");
	console.log(issueCountAndStoryPointsInBacklog);
}

readCSVAndGenerateReport();