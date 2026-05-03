import { db } from '../config/firebase.js';

export const submitSubsection = async (req, res) => {
  try {
    const { facultyId, subId } = req.params;
    const { criteria } = req.body;

    if (!criteria || !Array.isArray(criteria) || criteria.length === 0) {
      return res
        .status(400)
        .json({ success: false, message: 'Criteria is required' });
    }

    if (req.faculty.id !== facultyId) {
      return res
        .status(403)
        .json({ success: false, message: 'Unauthorized' });
    }

    const ref = db.collection('module1').doc(facultyId);
    const doc = await ref.get();

    let subsections = doc.exists ? doc.data().subsections || [] : [];

    const subIndex = subsections.findIndex(s => s.id === subId);

    const criteriaMap = {};

    if (subIndex > -1) {
      (subsections[subIndex].criteria || []).forEach(c => {
        criteriaMap[c.name] = c;
      });
    }

    criteria.forEach(c => {
      const old = criteriaMap[c.name];

      if (old?.isVerified) return;

      criteriaMap[c.name] = {
        name: c.name,
        claimedScore:
          Number(c.claimedScore) ?? old?.claimedScore ?? 0,
        maxScore:
          Number(c.maxScore) ?? old?.maxScore ?? 0,
        evidence:
          c.evidence ?? old?.evidence ?? '',
        facultyDescription:
          c.description ?? old?.facultyDescription ?? '',
        hodScore: old?.hodScore ?? null,
        hodDescription: old?.hodDescription ?? '',
        isVerified: false
      };
    });

    const updatedCriteria = Object.values(criteriaMap);

    const subsectionData = {
      id: subId,
      module: "module1", // <-- Added this line to fix UNKNOWN issue
      name:
        subsections[subIndex]?.name ||
        criteria[0]?.subsectionName ||
        `Subsection ${subId}`,
      maxScore: updatedCriteria.reduce(
        (sum, c) => sum + (c.maxScore || 0),
        0
      ),
      criteria: updatedCriteria
    };

    if (subIndex > -1) {
      subsections[subIndex] = subsectionData;
    } else {
      subsections.push(subsectionData);
    }

    await ref.set({ subsections }, { merge: true });

    return res.status(200).json({
      success: true,
      message: 'Subsection saved successfully'
    });
  } catch (error) {
    console.error('Submit Subsection Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

export const getFacultySubsections = async (req, res) => {
  try {
    const { facultyId } = req.params;
    if (!facultyId) {
      return res.status(400).json({ success: false, message: 'facultyId is required' });
    }

    const facultyRef = db.collection('module1').doc(facultyId);
    const facultyDoc = await facultyRef.get();

    const subsections = facultyDoc.exists ? facultyDoc.data().subsections || [] : [];

    return res.status(200).json({ success: true, data: subsections });
  } catch (error) {
    console.error('Get Faculty Subsections Error:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const hodViewAllSubmissions = async (req, res) => {
  try {
    const { college, department } = req.hod;

    if (!college || !department) {
      return res.status(400).json({ success: false, message: 'HOD college or department missing' });
    }

    if (req.hod.role !== 'hod') {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const facultySnap = await db
      .collection('faculty')
      .where('college', '==', college)
      .where('department', '==', department)
      .get();

    const facultyIds = facultySnap.docs.map(d => ({
      id: d.id,
      name: d.data().name
    }));

    const modules = ['module1', 'module5']; 
    const results = [];

    for (const f of facultyIds) {
      for (const moduleName of modules) {
        const doc = await db.collection(moduleName).doc(f.id).get();
        if (doc.exists) {
          // Ensure every subsection has module field
          const subsections = (doc.data().subsections || []).map(sub => ({
            ...sub,
            module: moduleName
          }));

          results.push({
            facultyId: f.id,
            facultyName: f.name,
            module: moduleName,          
            subsections
          });
        }
      }
    }

    res.status(200).json({ success: true, data: results });
  } catch (e) {
    console.error('hodViewAllSubmissions Error:', e);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const hodVerifyCriterion = async (req, res) => {
  try {
    const { facultyId, subId, criterionName } = req.params;
    let { hodScore, hodDescription } = req.body;

    if (req.hod.role !== 'hod') {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const ref = db.collection('module1').doc(facultyId);
    const doc = await ref.get();

    if (!doc.exists) {
      return res.status(404).json({ success: false, message: 'Submission not found' });
    }

    const subsections = doc.data().subsections || [];
    const sub = subsections.find(s => s.id === subId);

    if (!sub) {
      return res.status(404).json({ success: false, message: 'Subsection not found' });
    }

    const criterion = sub.criteria.find(c => c.name === criterionName);
    if (!criterion) {
      return res.status(404).json({ success: false, message: 'Criterion not found' });
    }

    hodScore = Number(hodScore) || 0;
    hodDescription = hodDescription || "";

    criterion.hodScore = hodScore;
    criterion.hodDescription = hodDescription;
    criterion.isVerified = true;

    await ref.update({ subsections });

    res.status(200).json({ success: true, message: 'Verified successfully' });
  } catch (e) {
    console.error('hodVerifyCriterion Error:', e);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};