import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
} from '@react-pdf/renderer';
import type { ResumeData } from '../types';

/* ────────────────────────────────────────────────────────────────────────
 *  Fonts — load Inter from a CDN so the PDF doesn't ship the font binary.
 *  If offline, react-pdf falls back to Helvetica which still looks fine.
 * ──────────────────────────────────────────────────────────────────── */
try {
  Font.register({
    family: 'Inter',
    fonts: [
      {
        src: 'https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMa1ZL7.ttf',
        fontWeight: 400,
      },
      {
        src: 'https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMa1pL7SUc.ttf',
        fontWeight: 600,
      },
      {
        src: 'https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMa25L7SUc.ttf',
        fontWeight: 700,
      },
    ],
  });
} catch {
  /* Font already registered (HMR) — ignore. */
}

const COLOR = {
  headerBand: '#11233f',
  text: '#1f2937',
  muted: '#475569',
  accent: '#1f4e9d',
  rule: '#1f4e9d',
  cellBg: '#f8fafc',
};

const styles = StyleSheet.create({
  page: {
    paddingTop: 0,
    paddingBottom: 28,
    paddingHorizontal: 0,
    fontFamily: 'Inter',
    fontSize: 9.5,
    color: COLOR.text,
  },

  /* ── Header band ────────────────────────────────────── */
  header: {
    backgroundColor: COLOR.headerBand,
    color: '#ffffff',
    paddingHorizontal: 36,
    paddingVertical: 22,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  headerLeft: { flexDirection: 'column', flex: 1 },
  name: { fontSize: 26, fontWeight: 700, letterSpacing: 1.2, color: '#ffffff' },
  title: { fontSize: 10.5, marginTop: 4, color: '#9bbcec' },
  tagline: { fontSize: 9, marginTop: 3, color: '#cbd5e1', fontStyle: 'italic' },

  headerRight: { textAlign: 'right', fontSize: 8.5, color: '#dbeafe' },
  contactLine: { marginBottom: 1.5 },

  /* ── Body ───────────────────────────────────────────── */
  body: { paddingHorizontal: 36, paddingTop: 18 },

  sectionHeader: {
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: 2,
    color: COLOR.accent,
    marginTop: 12,
    marginBottom: 4,
  },
  sectionRule: {
    borderBottomWidth: 1,
    borderBottomColor: COLOR.rule,
    marginBottom: 8,
  },

  summary: { fontSize: 9.5, lineHeight: 1.45, color: COLOR.text },

  /* ── Skills table ───────────────────────────────────── */
  skillsTable: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 2,
    overflow: 'hidden',
  },
  skillRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  skillRowLast: {
    flexDirection: 'row',
  },
  skillLabel: {
    width: 110,
    padding: 5,
    backgroundColor: COLOR.cellBg,
    fontWeight: 700,
    fontSize: 9,
  },
  skillValues: {
    flex: 1,
    padding: 5,
    fontSize: 9,
    color: COLOR.muted,
  },

  /* ── Experience ─────────────────────────────────────── */
  expEntry: { marginBottom: 9 },
  expHeaderRow: { flexDirection: 'row', justifyContent: 'space-between' },
  expRoleWrap: { flexDirection: 'row', flexWrap: 'wrap' },
  expRole: { fontSize: 10, fontWeight: 700 },
  expDivider: { fontSize: 10, color: COLOR.muted, marginHorizontal: 4 },
  expCompany: { fontSize: 10, color: COLOR.accent },
  expDates: { fontSize: 9, fontStyle: 'italic', color: COLOR.muted },
  expSubtitle: {
    fontSize: 9.5,
    color: COLOR.accent,
    marginTop: 1,
  },
  bullet: {
    flexDirection: 'row',
    marginTop: 2.5,
    paddingLeft: 6,
  },
  bulletMark: { width: 8, color: COLOR.muted },
  bulletText: { flex: 1, lineHeight: 1.4 },

  /* ── Education / certs ──────────────────────────────── */
  twoCol: { flexDirection: 'row', gap: 18 },
  col: { flex: 1 },
  itemTitle: { fontSize: 9.5, fontWeight: 700 },
  itemMeta: { fontSize: 9, color: COLOR.muted, marginTop: 1 },

  languages: { fontSize: 9.5, lineHeight: 1.5 },
  langDivider: { color: COLOR.muted, marginHorizontal: 4 },
});

interface Props {
  data: ResumeData;
}

function ContactLines({ contact }: { contact: ResumeData['contact'] }) {
  const lines = [
    contact.phone,
    contact.email,
    contact.linkedin,
    [contact.github, contact.location].filter(Boolean).join('  ·  ') ||
      undefined,
    contact.website,
  ].filter(Boolean) as string[];
  return (
    <>
      {lines.map((line, i) => (
        <Text key={i} style={styles.contactLine}>
          {line}
        </Text>
      ))}
    </>
  );
}

function SectionTitle({ children }: { children: string }) {
  return (
    <View>
      <Text style={styles.sectionHeader}>{children}</Text>
      <View style={styles.sectionRule} />
    </View>
  );
}

export function ResumePdfDocument({ data }: Props) {
  const skills = data.coreSkills ?? [];
  return (
    <Document
      title={`${data.name} — Resume`}
      author={data.name}
      subject="Resume"
    >
      <Page size="A4" style={styles.page}>
        {/* Header band */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.name}>{data.name.toUpperCase()}</Text>
            {data.title && <Text style={styles.title}>{data.title}</Text>}
            {data.tagline && (
              <Text style={styles.tagline}>{data.tagline}</Text>
            )}
          </View>
          <View style={styles.headerRight}>
            <ContactLines contact={data.contact ?? {}} />
          </View>
        </View>

        <View style={styles.body}>
          {/* Summary (UK / Europe / India) */}
          {data.summary && (
            <>
              <SectionTitle>SUMMARY</SectionTitle>
              <Text style={styles.summary}>{data.summary}</Text>
            </>
          )}

          {/* Core Skills */}
          {skills.length > 0 && (
            <>
              <SectionTitle>CORE SKILLS</SectionTitle>
              <View style={styles.skillsTable}>
                {skills.map((s, i) => (
                  <View
                    key={i}
                    style={i === skills.length - 1 ? styles.skillRowLast : styles.skillRow}
                  >
                    <Text style={styles.skillLabel}>{s.label}</Text>
                    <Text style={styles.skillValues}>
                      {(s.values ?? []).join(' · ')}
                    </Text>
                  </View>
                ))}
              </View>
            </>
          )}

          {/* Experience */}
          {data.experience?.length > 0 && (
            <>
              <SectionTitle>EXPERIENCE</SectionTitle>
              {data.experience.map((exp, i) => (
                <View key={i} style={styles.expEntry} wrap={false}>
                  <View style={styles.expHeaderRow}>
                    <View style={styles.expRoleWrap}>
                      <Text style={styles.expRole}>{exp.role}</Text>
                      <Text style={styles.expDivider}>|</Text>
                      <Text style={styles.expCompany}>
                        {[exp.company, exp.location].filter(Boolean).join(', ')}
                      </Text>
                    </View>
                    <Text style={styles.expDates}>{exp.dates}</Text>
                  </View>
                  {exp.subtitle && (
                    <Text style={styles.expSubtitle}>{exp.subtitle}</Text>
                  )}
                  {(exp.bullets ?? []).map((b, j) => (
                    <View key={j} style={styles.bullet}>
                      <Text style={styles.bulletMark}>▸</Text>
                      <Text style={styles.bulletText}>{b}</Text>
                    </View>
                  ))}
                </View>
              ))}
            </>
          )}

          {/* Education + Certifications side by side */}
          {(data.education?.length > 0 ||
            data.certifications?.length > 0) && (
            <>
              <SectionTitle>EDUCATION & CERTIFICATIONS</SectionTitle>
              <View style={styles.twoCol}>
                <View style={styles.col}>
                  {data.education.map((ed, i) => (
                    <View key={i} style={{ marginBottom: 4 }}>
                      <Text style={styles.itemTitle}>{ed.degree}</Text>
                      <Text style={styles.itemMeta}>
                        {[ed.school, ed.location, ed.dates]
                          .filter(Boolean)
                          .join(' · ')}
                      </Text>
                    </View>
                  ))}
                </View>
                <View style={styles.col}>
                  {data.certifications.map((c, i) => (
                    <View key={i} style={{ marginBottom: 4 }}>
                      <Text style={styles.itemTitle}>{c.name}</Text>
                      <Text style={styles.itemMeta}>
                        {[c.issuer, c.date, c.reference]
                          .filter(Boolean)
                          .join(' · ')}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            </>
          )}

          {/* Languages */}
          {data.languages?.length > 0 && (
            <>
              <SectionTitle>LANGUAGES</SectionTitle>
              <Text style={styles.languages}>
                {data.languages.map((l, i) => (
                  <Text key={i}>
                    {i > 0 && <Text style={styles.langDivider}> · </Text>}
                    <Text>{l}</Text>
                  </Text>
                ))}
              </Text>
            </>
          )}
        </View>
      </Page>
    </Document>
  );
}
