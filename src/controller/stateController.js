const { State } = require("../models");
const { stateMessages } = require("../constants/message/stateMessages");

const getAllStates = async (req, res, next) => {
  try {
    const states = await State.findAll({
      attributes: ["id", "name"],
      order: [["name", "ASC"]],
    });

    return res.status(200).json({
      success: true,
      message: stateMessages.statesFetchedSuccessfully,
      data: states,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAllStates,
};
