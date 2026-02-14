const express = require('express');
const router = express.Router();

// LOGIN
router.get('/', (req, res) => res.redirect('/app/login'));
router.get('/login', (req, res) => res.redirect('/app/login'));
router.get('/app/login', (req, res) => res.render('pages/users/login', { layout: false }));

// DASHBOARD
router.get('/app/dashboard', (req, res) => res.render('pages/users/dashboard'));
router.get('/app/account-settings', (req, res) => res.render('pages/users/account-settings'));
router.get('/app/notifications', (req, res) => res.render('pages/users/notifications'));

// MASTERS
router.get('/admin/masters/users', (req, res) => res.render('pages/admins/users'));
router.get('/admin/masters/admins', (req, res) => res.render('pages/admins/admins'));

// TASK
router.get('/app/task', (req, res) => res.render('pages/users/task'));
router.get('/app/task-history', (req, res) => res.render('pages/users/task-history'));
router.get('/admin/attendance', (req, res) => res.render('pages/admins/attendance'));
router.get('/app/documents', (req, res) => res.render('pages/users/documents'));
router.get('/app/notice', (req, res) => res.render('pages/users/notice'));
router.get('/app/calendar', (req, res) => res.render('pages/users/calendar'));

module.exports = router;
