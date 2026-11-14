const { verifyToken, sendJson, readJson } = require('../../lib/auth');
const db = require('../../lib/db');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return sendJson(res, 405, { error: 'Method not allowed.' });
  }

  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  const user = token ? verifyToken(token) : null;
  if (!user) return sendJson(res, 401, { error: 'Unauthorized.' });

  try {
    const body = await readJson(req);
    const submission = await db.submitKycSubmission({
      userId: user.id,
      fullName: body.fullName || user.name,
      dob: body.dob || null,
      docNumber: body.docNumber || 'ID-SUB',
      documentType: body.docType || 'national_id',
      frontUrl: body.frontUrl || 'https://probinary.app/docs/id-front-doc.png',
      backUrl: body.backUrl || null,
      selfieUrl: body.selfieUrl || null
    });

    return sendJson(res, 200, {
      success: true,
      submission,
      status: 'pending',
      message: 'KYC documents received. Status: Pending Administrator Verification.'
    });
  } catch (err) {
    return sendJson(res, 400, { error: err.message || 'Failed to submit KYC.' });
  }
};

