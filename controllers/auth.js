const passport = require('passport');
const validator = require('validator');
const User = require('../models/User');
const Chat = require('../models/Chat');

const guestCredentials = {
  email: 'guest@guest.com',
  password: 'guestpassword',
};

exports.getLogin = (req, res) => {
  if (req.user) {
    return res.redirect('/home');
  }
  res.render('login', {
    title: 'Login',
  });
};

exports.getGuest = (req, res, next) => {
  req.body.email = guestCredentials.email;
  req.body.password = guestCredentials.password;

  passport.authenticate('local', async (err, user, info) => {
    if (err) {
      return next(err);
    }
    if (!user) {
      req.flash('errors', info);
      return res.redirect('/login');
    }
    req.logIn(user, async (err) => {
      if (err) {
        return next(err);
      }
      try {
        // this is the async logic that clears the chat history for the guest user
        await Chat.deleteMany({ user: user._id });
        req.flash('success', { msg: 'Success! You are logged in as a guest.' });
        res.redirect('/home');
      } catch (err) {
        console.error('Error clearing chat history for guest:', err);
        return next(err);
      }
    });
  })(req, res, next);
};

exports.postLogin = (req, res, next) => {
  const validationErrors = [];
  if (!validator.isEmail(req.body.email)) {
    validationErrors.push({ msg: 'Please enter a valid email address.' });
  }
  if (validator.isEmpty(req.body.password)) {
    validationErrors.push({ msg: 'Password cannot be blank.' });
  }

  if (validationErrors.length) {
    req.flash('errors', validationErrors);
    return res.redirect('/login');
  }
  req.body.email = validator.normalizeEmail(req.body.email, { gmail_remove_dots: false });

  passport.authenticate('local', (err, user, info) => {
    if (err) {
      return next(err);
    }
    if (!user) {
      req.flash('errors', info);
      return res.redirect('/login');
    }
    req.logIn(user, (err) => {
      if (err) {
        return next(err);
      }
      req.flash('success', { msg: 'Success! You are logged in.' });
      res.redirect(req.session.returnTo || '/home');
    });
  })(req, res, next);
};

exports.logout = (req, res, next) => {
  req.logout((err) => {
    if (err) {
      console.log('Error logging out:', err);
      return next(err);
    }
    req.session.destroy((err) => {
      if (err) {
        console.log('Error: Failed to destroy the session during logout.', err);
        return next(err);
      }
      req.user = null;
      res.redirect('/');
    });
  });
};

exports.getSignup = (req, res) => {
  if (req.user) {
    return res.redirect('/home');
  }
  res.render('signup', {
    title: 'Create Account',
  });
};

exports.postSignup = async (req, res, next) => {
  const validationErrors = [];
  if (!validator.isEmail(req.body.email)) {
    validationErrors.push({ msg: 'Please enter a valid email address.' });
  }
  if (!validator.isLength(req.body.password, { min: 8 })) {
    validationErrors.push({ msg: 'Password must be at least 8 characters long' });
  }
  if (req.body.password !== req.body.confirmPassword) {
    validationErrors.push({ msg: 'Passwords do not match' });
  }

  if (validationErrors.length) {
    req.flash('errors', validationErrors);
    return res.redirect('/signup');
  }
  req.body.email = validator.normalizeEmail(req.body.email, { gmail_remove_dots: false });

  try {
    const existingUser = await User.findOne({ $or: [{ email: req.body.email }, { userName: req.body.userName }] });
    if (existingUser) {
      req.flash('errors', { msg: 'Account with that email address or username already exists.' });
      return res.redirect('/signup');
    }

    const user = new User({
      userName: req.body.userName,
      email: req.body.email,
      password: req.body.password,
    });

    await user.save();
    req.logIn(user, (err) => {
      if (err) {
        return next(err);
      }
      res.redirect('/');
    });
  } catch (err) {
    next(err);
  }
};
