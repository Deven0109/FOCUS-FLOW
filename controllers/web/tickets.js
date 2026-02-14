const models = require('./../../models/zindex');
const response = require('./../../utils/response');
const asyncHandler = require("express-async-handler");

const validators = require('./validators/tickets.v');

exports.getTickets = asyncHandler(async (req, res) => {
    let { search, page, limit, status } = req.body;

    let query = {
        $or: [
            { description: searchRegex },
            { ticketNumber: searchRegex }
        ]
    };

    if (status) { query.status = status; }
    let searchRegex = new RegExp(search, "i");
    let tickets = await models.Tickets.paginate(query, { page, limit, sort: { _id: -1 } });

    return response.success("Tickets fetched", tickets, res);
});

exports.saveTickets = asyncHandler(async (req, res) => {
    const { error, value } = validators.saveTicket.validate(req.body);
    if (error) {
        return response.success(error.message, null, res);
    }

    if (req.files && req.files.length > 0) {
        const screenshots = req.files.map(file => file.path);
        value.screenshots = screenshots;
    } else {
        value.screenshots = [];
    }

    await models.Tickets.create(value);
    return response.success("Tickets saved!", true, res);
});

exports.updateTickets = asyncHandler(async (req, res) => {
    const { error, value } = validators.updateTicket.validate(req.body);
    if (error) {
        return response.success(error.message, null, res);
    }

    if (value._id != null && value._id != "") {
        await models.Tickets.findByIdAndUpdate(value._id, value, { new: true });
        return response.success("Ticket updated successfuly", true, res);
    }
    return response.success("Invalid Object Id", null, res);
});

exports.deleteTicket = asyncHandler(async (req, res) => {
    const { id } = req.body;
    if (id != null && id != "") {
        await models.Tickets.findByIdAndDelete(id);
        return response.success("Tickets deleted successfully", true, res);
    }
    return response.success("Invalid Object Id", null, res);
})