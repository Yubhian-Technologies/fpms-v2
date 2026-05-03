import { db } from '../config/firebase.js';

export const submitAppeal = async (req, res) => {
  try {
    const { module, facultyId, subId, criterionName } = req.params;
    const { appealReason, evidence,requestedScore } = req.body; 

    if (!appealReason) {
      return res.status(400).json({
        success: false,
        message: 'Appeal reason is required'
      });
    }

    if (req.faculty.id !== facultyId) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized'
      });
    }

    const ref = db.collection(module).doc(facultyId);
    const doc = await ref.get();

    if (!doc.exists) {
      return res.status(404).json({
        success: false,
        message: 'Submission not found'
      });
    }

    const subsections = doc.data().subsections || [];
    const sub = subsections.find(s => s.id === subId);

    if (!sub) {
      return res.status(404).json({
        success: false,
        message: 'Subsection not found'
      });
    }

    const criterion = sub.criteria.find(c => c.name === criterionName);

    if (!criterion || !criterion.isVerified) {
      return res.status(400).json({
        success: false,
        message: 'Criterion not verified by HOD yet'
      });
    }

    await db.collection('appeals').add({
      module,
      facultyId,
      subId,
      criterionName,
      claimedScore: criterion.claimedScore,
      facultyDescription: criterion.facultyDescription,
      hodScore: criterion.hodScore,
       requestedScore,
      hodDescription: criterion.hodDescription,
      appealReason,
      evidence: evidence || "", 
      status: 'pending',
      createdAt: new Date()
    });

    return res.status(200).json({
      success: true,
      message: 'Appeal submitted successfully'
    });
  } catch (error) {
    console.error('Submit Appeal Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};


export const fetchAppealsByFaculty = async (req, res) => {
  try {
    const { facultyId } = req.params;

    if (!facultyId) {
      return res.status(400).json({ success: false, message: "Faculty ID is required" });
    }

    const appealsRef = db.collection("appeals").where("facultyId", "==", facultyId);
    const snapshot = await appealsRef.get();

    const appeals = [];
    snapshot.forEach(doc => appeals.push({ id: doc.id, ...doc.data() }));

    return res.status(200).json({ success: true, data: appeals });
  } catch (error) {
    console.error("Fetch Appeals Error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};