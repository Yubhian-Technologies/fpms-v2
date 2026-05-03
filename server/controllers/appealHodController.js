import { db } from "../config/firebase.js";
import { Timestamp } from "firebase-admin/firestore";



export const submitHodAppeal = async (req, res) => {
  try {
    const { subId, criterionName, module } = req.params;
    const { requestedScore, hodDescription, evidence } = req.body;
    const hodId = req.hod.id;

    if (requestedScore === undefined || !hodDescription) {
      return res.status(400).json({
        success: false,
        message: "Requested score and description are required"
      });
    }

    const hodRef = db.collection(`${module}_hod`).doc(hodId);
    const hodSnap = await hodRef.get();

    if (!hodSnap.exists) {
      return res.status(404).json({
        success: false,
        message: "HOD submission not found"
      });
    }

    const subsections = hodSnap.data().subsections || [];
    const subsection = subsections.find(s => s.id === subId);
    if (!subsection) {
      return res.status(404).json({ success: false, message: "Subsection not found" });
    }

    const criterion = subsection.criteria.find(c => c.name === criterionName);
    if (!criterion) {
      return res.status(404).json({ success: false, message: "Criterion not found" });
    }

    const existing = await db.collection("appeals-hod")
      .where("hodId", "==", hodId)
      .where("module", "==", module)
      .where("subId", "==", subId)
      .where("criterionName", "==", criterionName)
      .where("status", "==", "pending")
      .get();

    if (!existing.empty) {
      return res.status(400).json({
        success: false,
        message: "Appeal already pending"
      });
    }

    await db.collection("appeals-hod").add({
      type: "hod",
      module,
      subId,
      criterionName,
      hodId,
      claimedScore: criterion.claimedScore || 0,
      hodScore: criterion.hodScore || null,
      requestedScore: Number(requestedScore),
      hodDescription,
      evidence: evidence || "",
      status: "pending",
      verifiedByCommittee: false,
      createdAt: Timestamp.now()
    });

    return res.status(200).json({
      success: true,
      message: "HOD appeal submitted successfully"
    });

  } catch (error) {
    console.error("Submit HOD Appeal Error:", error);
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};



export const fetchHodAppeals = async (req, res) => {
  try {
    const hodId = req.hod.id;

    const snapshot = await db.collection("appeals-hod")
      .where("hodId", "==", hodId)
      .get();

    const appeals = snapshot.docs
      .map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || null,
        committeeVerifiedAt: doc.data().committeeVerifiedAt?.toDate() || null
      }))
      .sort((a, b) => b.createdAt - a.createdAt);

    return res.status(200).json({
      success: true,
      data: appeals
    });

  } catch (error) {
    console.error("Fetch HOD Appeals Error:", error);
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};



export const fetchAllHodAppeals = async (req, res) => {
  try {
    const snapshot = await db.collection("appeals-hod").get();

    const appeals = snapshot.docs
      .map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || null
      }))
      .sort((a, b) => b.createdAt - a.createdAt);

    return res.status(200).json({
      success: true,
      data: appeals
    });

  } catch (error) {
    console.error("Fetch All HOD Appeals Error:", error);
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

export const verifyHodAppeal = async (req, res) => {
  try {
    const { appealId } = req.params;
    const { committeeScore, committeeRemarks } = req.body;

    if (committeeScore === undefined) {
      return res.status(400).json({
        success: false,
        message: "Committee score required"
      });
    }

    const appealRef = db.collection("appeals-hod").doc(appealId);

    await db.runTransaction(async (transaction) => {

     
      const appealSnap = await transaction.get(appealRef);

      if (!appealSnap.exists) {
        throw new Error("Appeal not found");
      }

      const appealData = appealSnap.data();

      if (appealData.verifiedByCommittee) {
        throw new Error("Appeal already verified");
      }

      const { module, hodId, subId, criterionName } = appealData;

      const hodRef = db.collection(`${module}_hod`).doc(hodId);
      const hodSnap = await transaction.get(hodRef);

      if (!hodSnap.exists) {
        throw new Error("HOD record not found");
      }

     
      const data = hodSnap.data();
      let subsections = data.subsections || [];

      subsections = subsections.map(sub => {
        if (sub.id === subId) {
          sub.criteria = sub.criteria.map(c => {
            if (c.name === criterionName) {
              return {
                ...c,
                adminScore: Number(committeeScore)
              };
            }
            return c;
          });
        }
        return sub;
      });

     
      transaction.update(appealRef, {
        committeeScore: Number(committeeScore),
        committeeRemarks: committeeRemarks || "",
        status: "committee_verified",
        verifiedByCommittee: true,
        committeeVerifiedAt: Timestamp.now()
      });

      transaction.update(hodRef, { subsections });

    });

    return res.status(200).json({
      success: true,
      message: "HOD appeal verified successfully"
    });

  } catch (error) {
    console.error("Verify HOD Appeal Error:", error);
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};