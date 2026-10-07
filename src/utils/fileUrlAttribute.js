"use strict";
const { getFileUrl } = require("./s3");

/**
 * Model attribute for an uploaded file. The column stores the S3 key (or a
 * local "/uploads/..." path); reading it — including toJSON() in API
 * responses — returns the link from getFileUrl (a CloudFront signed URL).
 *
 *   startPhotoUrl: fileUrlAttribute(DataTypes, "startPhotoUrl"),
 */
function fileUrlAttribute(DataTypes, name, length = 500) {
  return {
    type: DataTypes.STRING(length),
    get() {
      return getFileUrl(this.getDataValue(name));
    },
  };
}

module.exports = { fileUrlAttribute };
