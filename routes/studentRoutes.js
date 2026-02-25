const express = require('express');
const User = require('../models/User');
const Project = require('../models/Project');
const { protect, authorizeDeveloper } = require('../middleware/authMiddleware');
const multer = require('multer');
const path = require('path');
const router = express.Router();

// Multer Storage Configuration
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        cb(null, `${Date.now()}-${file.originalname}`);
    }
});

const upload = multer({
    storage: storage,
    fileFilter: (req, file, cb) => {
        const filetypes = /zip|pdf|mp4|mov|avi|mkv/;
        const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = filetypes.test(file.mimetype);

        if (extname) {
            return cb(null, true);
        } else {
            cb('Error: Only ZIP, PDF, and Video files are allowed!');
        }
    }
});

// @desc    Update a student (incl. password)
// @route   PUT /api/students/:id
// @access  Private/Developer
router.put('/:id', protect, authorizeDeveloper, async (req, res) => {
    try {
        const user = await User.findById(req.params.id);

        if (user) {
            user.name = req.body.name || user.name;
            user.username = req.body.username || user.username;

            if (req.body.password) {
                user.password = req.body.password;
            }

            user.assignedDeveloper = req.body.assignedDeveloper || user.assignedDeveloper;

            // Allow clearing document paths
            if (req.body.pdfPath !== undefined) user.pdfPath = req.body.pdfPath;
            if (req.body.zipPath !== undefined) user.zipPath = req.body.zipPath;
            if (req.body.videoPath !== undefined) user.videoPath = req.body.videoPath;
            if (req.body.documentPath !== undefined) user.documentPath = req.body.documentPath;

            const updatedUser = await user.save();
            res.json({
                _id: updatedUser._id,
                name: updatedUser.name,
                username: updatedUser.username,
                role: updatedUser.role
            });
        } else {
            res.status(404).json({ message: 'User not found' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @desc    Upload document for student
// @route   POST /api/students/:id/upload
// @access  Private/Developer
router.post('/:id/upload', protect, authorizeDeveloper, upload.single('document'), async (req, res) => {
    try {
        const user = await User.findById(req.params.id);

        if (user) {
            const ext = path.extname(req.file.originalname).toLowerCase();

            if (ext === '.pdf') {
                user.pdfPath = req.file.path;
            } else if (ext === '.zip') {
                user.zipPath = req.file.path;
            } else if (['.mp4', '.mov', '.avi', '.mkv'].includes(ext)) {
                user.videoPath = req.file.path;
            } else {
                user.documentPath = req.file.path;
            }

            await user.save();
            res.json({ message: 'File uploaded successfully', path: req.file.path });
        } else {
            res.status(404).json({ message: 'User not found' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @desc    Create a student account
// @route   POST /api/students
// @access  Private/Developer
router.post('/', protect, authorizeDeveloper, async (req, res) => {
    const { name, username, password } = req.body;

    try {
        const userExists = await User.findOne({ username });

        if (userExists) {
            return res.status(400).json({ message: 'Student already exists' });
        }

        const student = await User.create({
            name,
            username,
            password,
            role: 'student',
            assignedDeveloper: req.user._id // Assign to the developer who created them
        });

        res.status(201).json(student);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @desc    Get all students
// @route   GET /api/students
// @access  Private/Developer
router.get('/', protect, authorizeDeveloper, async (req, res) => {
    try {
        const students = await User.find({ role: 'student', assignedDeveloper: req.user._id })
            .populate('assignedDeveloper', 'name')
            .select('-password');
        res.json(students);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @desc    Get dashboard statistics
// @route   GET /api/students/stats/global
// @access  Private/Developer
router.get('/stats/global', protect, authorizeDeveloper, async (req, res) => {
    try {
        const myStudents = await User.find({ role: 'student', assignedDeveloper: req.user._id }).select('_id');
        const studentIds = myStudents.map(s => s._id);

        const totalStudents = studentIds.length;
        const projects = await Project.find({ student: { $in: studentIds } });
        const totalProjects = projects.length;
        const totalRevenue = projects.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);

        res.json({
            totalStudents,
            totalProjects,
            totalRevenue
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @desc    Assign project to student
// @route   POST /api/students/assign-project
// @access  Private/Developer
router.post('/assign-project', protect, authorizeDeveloper, async (req, res) => {
    const { title, description, studentId, submissionDate, frontend, backend, database, amount } = req.body;

    try {
        const project = await Project.create({
            title,
            description,
            student: studentId,
            submissionDate,
            frontend,
            backend,
            database,
            amount: Number(amount),
            status: 'Pending'
        });

        res.status(201).json(project);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @desc    Get projects for logged-in student
// @route   GET /api/students/my-projects
// @access  Private/Student
router.get('/my-projects', protect, async (req, res) => {
    try {
        const projects = await Project.find({ student: req.user._id });
        res.json(projects);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @desc    Get single student details
// @route   GET /api/students/:id
// @access  Private/Developer
router.get('/:id', protect, authorizeDeveloper, async (req, res) => {
    try {
        const student = await User.findById(req.params.id)
            .populate('assignedDeveloper', 'name')
            .select('-password');
        if (!student) {
            return res.status(404).json({ message: 'Student not found' });
        }

        const projects = await Project.find({ student: student._id });
        res.json({ student, projects });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @desc    Update project details
// @route   PUT /api/students/project/:id
// @access  Private/Developer
router.put('/project/:id', protect, authorizeDeveloper, async (req, res) => {
    try {
        const project = await Project.findById(req.params.id);

        if (project) {
            project.title = req.body.title || project.title;
            project.description = req.body.description || project.description;
            project.status = req.body.status || project.status;
            project.frontend = req.body.frontend || project.frontend;
            project.backend = req.body.backend || project.backend;
            project.database = req.body.database || project.database;
            project.amount = req.body.amount !== undefined ? Number(req.body.amount) : project.amount;
            project.submissionDate = req.body.submissionDate || project.submissionDate;

            const updatedProject = await project.save();
            res.json(updatedProject);
        } else {
            res.status(404).json({ message: 'Project not found' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});


// @desc    Save invoice draft
// @route   PUT /api/students/project/:id/save-bill
// @access  Private/Developer
router.put('/project/:id/save-bill', protect, authorizeDeveloper, async (req, res) => {
    try {
        const project = await Project.findById(req.params.id);

        if (project) {
            project.invoiceDetails = {
                ...req.body,
                isSent: project.invoiceDetails?.isSent || false
            };

            const updatedProject = await project.save();
            res.json(updatedProject);
        } else {
            res.status(404).json({ message: 'Project not found' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @desc    Save and Send invoice to student
// @route   PUT /api/students/project/:id/send-bill
// @access  Private/Developer
router.put('/project/:id/send-bill', protect, authorizeDeveloper, async (req, res) => {
    try {
        const project = await Project.findById(req.params.id);

        if (project) {
            project.invoiceDetails = {
                ...req.body,
                isSent: true
            };

            const updatedProject = await project.save();
            res.json(updatedProject);
        } else {
            res.status(404).json({ message: 'Project not found' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;
