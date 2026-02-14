const models = require('./../../models/zindex');
const response = require('./../../utils/response');
const asyncHandler = require("express-async-handler");

let validators = require('./validators/project.v');

exports.getProjects = asyncHandler(async (req, res) => {
    let { search, page, limit } = req.body;
    let searchRegex = new RegExp(search, "i");
    let projects = await models.Project.paginate({
        $or: { name: searchRegex }
    }, { page, limit, sort: { _id: -1 } });
    return response.success("Projects fetched successfully", projects, res);
})

exports.saveProjects = asyncHandler(async (req, res) => {
    let { error, value } = validators.saveProject.validate(req.body);

    if (error) { return response.success(error.message, null, res); }
    if (value._id != null && value._id != "") {
        const id = value._id;
        delete value._id;
        await models.Project.findByIdAndUpdate(id, value, { new: true });
        return response.success("Project updated successfully!", true, res);
    }

    await models.Project.create(value);
    return response.success("Project created successfully!", true, res);
});

exports.deleteProject = asyncHandler(async (req, res) => {
    const { id } = req.body;

    let ticketRaised = await models.Tickets.countDocuments({ projectId: id });
    if (ticketRaised > 0) {
        return response.success("Ticked is raised with this project!", null, res);
    }

    await models.Project.findByIdAndDelete(id, { new: true });
    return response.success("Project deleted successfully!", true, res);
});