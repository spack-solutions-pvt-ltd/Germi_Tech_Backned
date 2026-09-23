"use strict";

const LOGO_CID = "germitech-logo";

function emailLayout({ title, bodyHtml }) {
  return `
    <!DOCTYPE html>
    <html>
      <body style="
        margin:0;
        padding:0;
        background-color:#f4f4f4;
        font-family:Arial, Helvetica, sans-serif;
      ">
        <table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 0;">
          <tr>
            <td align="center">

              <table
                width="480"
                cellpadding="0"
                cellspacing="0"
                style="
                  background:#ffffff;
                  border-radius:8px;
                  overflow:hidden;
                "
              >

                <!-- Header -->
                <tr>
                  <td style="
                    background-color:#769b69;
                    padding:24px;
                    text-align:center;
                  ">
                    <img
                      src="cid:${LOGO_CID}"
                      alt="Germitech"
                      style="height:40px; display:block; margin:auto;"
                    />
                  </td>
                </tr>

                <!-- Content -->
                <tr>
                  <td style="padding:32px;">
                    <h2 style="
                      color:#2b2b2b;
                      margin-top:0;
                    ">
                      ${title}
                    </h2>

                    ${bodyHtml}
                  </td>
                </tr>

                <!-- Footer -->
                <tr>
                  <td style="
                    background-color:#f0f0f0;
                    padding:16px;
                    text-align:center;
                    font-size:12px;
                    color:#888;
                  ">
                    &copy; ${new Date().getFullYear()} Germitech.
                    All rights reserved.
                  </td>
                </tr>

              </table>

            </td>
          </tr>
        </table>
      </body>
    </html>
  `;
}

module.exports = {
  emailLayout,
  LOGO_CID,
};
