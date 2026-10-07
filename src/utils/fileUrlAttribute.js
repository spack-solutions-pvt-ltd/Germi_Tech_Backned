"use strict";
const { resolveFileUrl } = require("./s3");

/**
 * Model attribute for an uploaded file. The column stores the S3 key (or a
 * legacy "/uploads/..." path); reading it — including toJSON() in API
 * responses — returns the viewable URL via resolveFileUrl.
 *
 *   startPhotoUrl: fileUrlAttribute(DataTypes, "startPhotoUrl"),
 */
function fileUrlAttribute(DataTypes, name, length = 500) {
  return {
    type: DataTypes.STRING(length),
    get() {
      return resolveFileUrl(this.getDataValue(name));
    },
  };
}

module.exports = { fileUrlAttribute };
