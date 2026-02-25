const mongoose = require('mongoose');

const ProjectSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true
    },
    description: {
        type: String,
        required: true
    },
    student: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    submissionDate: {
        type: Date,
        required: true
    },
    frontend: {
        type: String,
        default: ''
    },
    backend: {
        type: String,
        default: ''
    },
    database: {
        type: String,
        default: ''
    },
    amount: {
        type: Number,
        default: 0
    },
    status: {
        type: String,
        enum: ['Pending', 'Process', 'Start', 'Backend Work', 'Frontend Work', 'Database Work', 'Completed'],
        default: 'Pending'
    },
    invoiceDetails: {
        invoiceNo: String,
        date: String,
        companyName: String,
        companyAddress: String,
        title: String,
        description: String,
        frontend: String,
        backend: String,
        database: String,
        amount: String,
        paymentStatus: { type: String, default: 'Pending' },
        paymentMethod: String,
        signatory: String,
        isSent: { type: Boolean, default: false }
    }
}, { timestamps: true });

module.exports = mongoose.model('Project', ProjectSchema);
