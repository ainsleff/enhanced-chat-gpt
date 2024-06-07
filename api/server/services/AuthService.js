const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { errorsToString } = require('librechat-data-provider');
const { countUsers, createUser, getUser, updateUser } = require('~/models/userMethods');
const { sendEmail, checkEmailConfig } = require('~/server/utils');
const { registerSchema } = require('~/strategies/validators');
const isDomainAllowed = require('./isDomainAllowed');
const Token = require('~/models/schema/tokenSchema');
const Session = require('~/models/Session');
const { logger } = require('~/config');
const User = require('~/models/User');

const domains = {
  client: process.env.DOMAIN_CLIENT,
  server: process.env.DOMAIN_SERVER,
};

const isProduction = process.env.NODE_ENV === 'production';

/**
 * Logout user
 *
 * @param {String} userId
 * @param {*} refreshToken
 * @returns
 */
const logoutUser = async (userId, refreshToken) => {
  try {
    const hash = crypto.createHash('sha256').update(refreshToken).digest('hex');

    // Find the session with the matching user and refreshTokenHash
    const session = await Session.findOne({ user: userId, refreshTokenHash: hash });
    if (session) {
      try {
        await Session.deleteOne({ _id: session._id });
      } catch (deleteErr) {
        logger.error('[logoutUser] Failed to delete session.', deleteErr);
        return { status: 500, message: 'Failed to delete session.' };
      }
    }

    return { status: 200, message: 'Logout successful' };
  } catch (err) {
    return { status: 500, message: err.message };
  }
};

const sendVerificationEmail = async (user) => {
  let verifyToken = crypto.randomBytes(32).toString('hex');
  const hash = bcrypt.hashSync(verifyToken, 10);

  await new Token({
    userId: user._id,
    email: user.email,
    token: hash,
    createdAt: Date.now(),
  }).save();

  const verificationLink = `${domains.client}/verify?token=${verifyToken}&email=${user.email}`;

  sendEmail(
    user.email,
    'Verify your email',
    {
      appName: process.env.APP_TITLE || 'LibreChat',
      name: user.name,
      verificationLink: verificationLink,
      year: new Date().getFullYear(),
    },
    'verifyEmail.handlebars',
  );
  return;
};

/**
 * Verify Email
 * @param {Express.Request} req
 */
const verifyEmail = async (req) => {
  const { email, token } = req.body;
  let emailVerificationData = await Token.findOne({ email });

  if (!emailVerificationData) {
    return new Error('Invalid or expired password reset token');
  }

  const isValid = bcrypt.compareSync(token, emailVerificationData.token);

  if (!isValid) {
    return new Error('Invalid or expired email verification token');
  }

  const updatedUser = await updateUser(emailVerificationData.userId, { emailVerified: true });
  if (!updatedUser) {
    return new Error('User not found');
  }

  await emailVerificationData.deleteOne();
  return { message: 'Email verification was successful' };
};

/**
 * Register a new user
 *
 * @param {Object} user <email, password, name, username>
 * @returns
 */
const registerUser = async (user) => {
  const { error } = registerSchema.safeParse(user);
  if (error) {
    const errorMessage = errorsToString(error.errors);
    logger.info(
      'Route: register - Validation Error',
      { name: 'Request params:', value: user },
      { name: 'Validation error:', value: errorMessage },
    );

    return { status: 404, message: errorMessage };
  }

  const { email, password, name, username } = user;

  try {
    const existingUser = await getUser({ email }, 'email _id');

    if (existingUser) {
      logger.info(
        'Register User - Email in use',
        { name: 'Request params:', value: user },
        { name: 'Existing user:', value: existingUser },
      );

      // Sleep for 1 second
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // TODO: We should change the process to always email and be generic is signup works or fails (user enum)
      return { status: 500, message: 'Something went wrong' };
    }

    if (!(await isDomainAllowed(email))) {
      const errorMessage = 'Registration from this domain is not allowed.';
      logger.error(`[registerUser] [Registration not allowed] [Email: ${user.email}]`);
      return { status: 403, message: errorMessage };
    }

    //determine if this is the first registered user (not counting anonymous_user)
    const isFirstRegisteredUser = (await countUsers()) === 0;

    const salt = bcrypt.genSaltSync(10);
    const newUserData = {
      provider: 'local',
      email,
      username,
      name,
      avatar: null,
      role: isFirstRegisteredUser ? 'ADMIN' : 'USER',
      password: bcrypt.hashSync(password, salt),
    };

    const emailEnabled = checkEmailConfig();
    const newUser = await createUser(newUserData, emailEnabled === false);
    if (emailEnabled) {
      await sendVerificationEmail(newUser);
    } else {
      await updateUser(newUser._id, { emailVerified: true });
    }

    return { status: 200, user: newUser };
  } catch (err) {
    return { status: 500, message: err?.message || 'Something went wrong' };
  }
};

/**
 * Request password reset
 * @param {Express.Request} req
 */
const requestPasswordReset = async (req) => {
  const { email } = req.body;
  const user = await getUser({ email }, 'email _id');
  const emailEnabled = checkEmailConfig();

  logger.warn(`[requestPasswordReset] [Password reset request initiated] [Email: ${email}]`);

  if (!user) {
    logger.warn(`[requestPasswordReset] [No user found] [Email: ${email}] [IP: ${req.ip}]`);
    return {
      message: 'If an account with that email exists, a password reset link has been sent to it.',
    };
  }

  let token = await Token.findOne({ userId: user._id });
  if (token) {
    await token.deleteOne();
  }

  let resetToken = crypto.randomBytes(32).toString('hex');
  const hash = bcrypt.hashSync(resetToken, 10);

  await new Token({
    userId: user._id,
    token: hash,
    createdAt: Date.now(),
  }).save();

  const link = `${domains.client}/reset-password?token=${resetToken}&userId=${user._id}`;

  if (emailEnabled) {
    sendEmail(
      user.email,
      'Password Reset Request',
      {
        appName: process.env.APP_TITLE || 'LibreChat',
        name: user.name,
        link: link,
        year: new Date().getFullYear(),
      },
      'requestPasswordReset.handlebars',
    );
    logger.info(
      `[requestPasswordReset] Link emailed. [Email: ${email}] [ID: ${user._id}] [IP: ${req.ip}]`,
    );
  } else {
    logger.info(
      `[requestPasswordReset] Link issued. [Email: ${email}] [ID: ${user._id}] [IP: ${req.ip}]`,
    );
    return { link };
  }

  return {
    message: 'If an account with that email exists, a password reset link has been sent to it.',
  };
};

/**
 * Reset Password
 *
 * @param {*} userId
 * @param {String} token
 * @param {String} password
 * @returns
 */
const resetPassword = async (userId, token, password) => {
  let passwordResetToken = await Token.findOne({ userId });

  if (!passwordResetToken) {
    return new Error('Invalid or expired password reset token');
  }

  const isValid = bcrypt.compareSync(token, passwordResetToken.token);

  if (!isValid) {
    return new Error('Invalid or expired password reset token');
  }

  const hash = bcrypt.hashSync(password, 10);
  const user = await updateUser(userId, { password: hash });

  if (checkEmailConfig()) {
    sendEmail(
      user.email,
      'Password Reset Successfully',
      {
        appName: process.env.APP_TITLE || 'LibreChat',
        name: user.name,
        year: new Date().getFullYear(),
      },
      'passwordReset.handlebars',
    );
  }

  await passwordResetToken.deleteOne();
  logger.info(`[resetPassword] Password reset successful. [Email: ${user.email}]`);
  return { message: 'Password reset was successful' };
};

/**
 * Set Auth Tokens
 *
 * @param {String} userId
 * @param {Object} res
 * @param {String} sessionId
 * @returns
 */
const setAuthTokens = async (userId, res, sessionId = null) => {
  try {
    const user = await User.findOne({ _id: userId });
    const token = await user.generateToken();

    let session;
    let refreshTokenExpires;
    if (sessionId) {
      session = await Session.findById(sessionId);
      refreshTokenExpires = session.expiration.getTime();
    } else {
      session = new Session({ user: userId });
      const { REFRESH_TOKEN_EXPIRY } = process.env ?? {};
      const expires = eval(REFRESH_TOKEN_EXPIRY) ?? 1000 * 60 * 60 * 24 * 7;
      refreshTokenExpires = Date.now() + expires;
    }

    const refreshToken = await session.generateRefreshToken();

    res.cookie('refreshToken', refreshToken, {
      expires: new Date(refreshTokenExpires),
      httpOnly: true,
      secure: isProduction,
      sameSite: 'strict',
    });

    return token;
  } catch (error) {
    logger.error('[setAuthTokens] Error in setting authentication tokens:', error);
    throw error;
  }
};

module.exports = {
  registerUser,
  logoutUser,
  verifyEmail,
  isDomainAllowed,
  requestPasswordReset,
  resetPassword,
  setAuthTokens,
};
