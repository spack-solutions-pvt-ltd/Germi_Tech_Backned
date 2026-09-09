"use strict";
const bcrypt = require("bcrypt");
const {
  sequelize,
  Employee,
  EmployeeDocument,
  EmployeeInsurance,
  Role,
} = require("../models");
const { generateDummyPassword } = require("../utils/randomPassword");
const { sendMail } = require("../utils/mailer");
const { welcomeEmailTemplate } = require("../templates/welcomeEmail");
const { createEmployeeSchema } = require("../validators/employeeValidation");
const generateId = require("../utils/generateIds");

// POST /api/employees

const createEmployee = async (req, res, next) => {
  let transaction;

  try {
    const parsed = createEmployeeSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(422).json({
        success: false,
        message: "Validation failed",
        errors: parsed.error.flatten(),
      });
    }

    const {
      name,
      number,
      alternateNumber,
      email,
      level,
      roleId,
      status,
      documents = [],
      insurances = [],
    } = parsed.data;

    transaction = await sequelize.transaction();

    const empId = generateId("EMP");
    const plainPassword = generateDummyPassword();
    const passwordHash = await bcrypt.hash(plainPassword, 10);

    const employee = await Employee.create(
      {
        empId,
        name,
        number,
        alternateNumber,
        email,
        password: passwordHash,
        level,
        roleId,
        status: status || "Active",
      },
      {
        transaction,
      },
    );

    if (documents.length > 0) {
      const employeeDocuments = documents.map((document) => ({
        ...document,
        employeeId: employee.id,
      }));

      await EmployeeDocument.bulkCreate(employeeDocuments, {
        transaction,
      });
    }

    if (insurances.length > 0) {
      const employeeInsurances = insurances.map((insurance) => ({
        ...insurance,
        employeeId: employee.id,
      }));

      await EmployeeInsurance.bulkCreate(employeeInsurances, {
        transaction,
      });
    }

    await transaction.commit();

    let emailSent = false;
    let emailError = null;

    if (email) {
      try {
        await sendMail({
          to: email,
          subject: "Welcome to Germitech — Your Login Details",
          html: welcomeEmailTemplate({
            name,
            empId: employee.empId,
            email,
            password: plainPassword,
            loginUrl:
              process.env.FRONTEND_LOGIN_URL ||
              "https://app.germitech.com/login",
          }),
        });

        emailSent = true;
      } catch (error) {
        emailError = error.message;
      }
    } else {
      emailError =
        "No email provided for this employee. Please share the password manually.";
    }

    const createdEmployee = await Employee.findByPk(employee.id, {
      include: [
        {
          model: EmployeeDocument,
          as: "documents",
        },
        {
          model: EmployeeInsurance,
          as: "insurances",
        },
        {
          model: Role,
          as: "role",
        },
      ],
    });

    return res.status(201).json({
      success: true,
      message: "Employee created successfully",
      data: {
        employee: createdEmployee,
        emailSent,
        emailError,
        temporaryPassword: emailSent ? undefined : plainPassword,
      },
    });
  } catch (error) {
    if (transaction && !transaction.finished) {
      await transaction.rollback();
    }

    next(error);
  }
};

module.exports = { createEmployee };
