"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import "./ProjectsPage.css";
import CreateProjectModal from "../../components/projects/CreateProjectModal";
import EditProjectModal from "../../components/projects/EditProjectModal";
import EmptyState from "../../components/ui/EmptyState";
import ConfirmModal from "../../components/ui/ConfirmModal";
import { SkeletonRows } from "../../components/ui/Skeleton";
import {
  createProject,
  deleteProject,
  listProjects,
  updateProject,
  type ProjectRecord,
} from "../../services/projectService";
import {
  createTag,
  deleteTag,
  listTags,
  renameTag,
  type TagRecord,
} from "../../services/tagsService";

// Cross-page hand-off replacing react-router's location.state: the selected
// project is stashed in sessionStorage for PumpSelectionPage to read on load.
export const SELECTED_PROJECT_KEY = "selectedProject";

const ProjectsPage = () => {
  const router = useRouter();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const [editing, setEditing] = useState<ProjectRecord | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState<ProjectRecord | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Per-project tag state. Tags load lazily on first expansion so the projects
  // list itself stays a single round-trip; once loaded, they're cached in this
  // map for the life of the page. `expanded` tracks which rows are currently
  // open. `pending` covers "loading tags" and "processing an add/rename/
  // delete" so we can gray the row while the request is in flight.
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [tagsByProject, setTagsByProject] = useState<Record<string, TagRecord[]>>({});
  const [tagsLoadingFor, setTagsLoadingFor] = useState<Set<string>>(new Set());
  const [tagsErrorFor, setTagsErrorFor] = useState<Record<string, string>>({});
  const [addingTagFor, setAddingTagFor] = useState<string | null>(null);
  const [newTagName, setNewTagName] = useState("");
  const [renamingTagId, setRenamingTagId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [confirmingDeleteTag, setConfirmingDeleteTag] = useState<TagRecord | null>(null);
  const [deletingTagId, setDeletingTagId] = useState<string | null>(null);

  // Filters — client name matches project.name (the "Client Name" column;
  // that's what the Create/Edit forms actually call this field), enquiry
  // code matches project.project_code. Independent, case-insensitive
  // substring matches, combined with AND.
  const [clientNameFilter, setClientNameFilter] = useState("");
  const [enquiryCodeFilter, setEnquiryCodeFilter] = useState("");

  const loadProjects = () => {
    setIsLoading(true);
    setError(null);
    listProjects()
      .then(setProjects)
      .catch(() => setError("Couldn't load enquiries."))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    loadProjects();
  }, []);

  const handleCreateProject = async (input: {
    projectCode: string;
    name: string;
    clientCode: string;
    industry: string;
  }): Promise<string | null> => {
    setIsCreating(true);
    try {
      // createdBy is derived server-side from the session cookie, not sent
      // by the client.
      const created = await createProject(input);
      setProjects((prev) => [created, ...prev]);
      setIsModalOpen(false);
      return null;
    } catch (err) {
      // Surface the API's specific message (e.g. duplicate Enquiry no.) so the
      // modal can show it inline instead of a generic failure.
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        "Couldn't create the project. Please try again.";
      return msg;
    } finally {
      setIsCreating(false);
    }
  };

  // Open the wizard scoped to a specific tag. If no tag is passed (legacy
  // "Open project" button) the server resolves to the project's Default tag
  // via the projectId fallback - safe for enquiries that only have one tag.
  const openProject = (project: ProjectRecord, tag?: TagRecord) => {
    sessionStorage.setItem(
      SELECTED_PROJECT_KEY,
      JSON.stringify({
        id: project.id,
        code: project.project_code,
        name: project.name,
        customer: project.customer_name,
        status: project.status,
        tagId: tag?.id,
        tagName: tag?.name,
      })
    );
    router.push("/pump-selection");
  };

  // Toggle a project's nested tag list. First expansion also triggers a
  // one-time tag fetch (cached in tagsByProject afterwards) so opening the
  // same project again is instant. Deliberately doesn't refetch on re-expand -
  // the create/rename/delete handlers keep the cache in sync themselves.
  const toggleExpanded = (projectId: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(projectId)) {
        next.delete(projectId);
      } else {
        next.add(projectId);
        if (!tagsByProject[projectId] && !tagsLoadingFor.has(projectId)) {
          setTagsLoadingFor((l) => new Set(l).add(projectId));
          setTagsErrorFor((e) => {
            const { [projectId]: _drop, ...rest } = e;
            return rest;
          });
          listTags(projectId)
            .then((tags) => setTagsByProject((m) => ({ ...m, [projectId]: tags })))
            .catch(() => setTagsErrorFor((e) => ({ ...e, [projectId]: "Couldn't load tags." })))
            .finally(() =>
              setTagsLoadingFor((l) => {
                const n = new Set(l);
                n.delete(projectId);
                return n;
              }),
            );
        }
      }
      return next;
    });
  };

  const startAddTag = (projectId: string) => {
    setAddingTagFor(projectId);
    setNewTagName("");
  };
  const cancelAddTag = () => {
    setAddingTagFor(null);
    setNewTagName("");
  };
  const handleAddTag = async (projectId: string) => {
    const name = newTagName.trim();
    if (!name) return;
    try {
      const created = await createTag(projectId, name);
      setTagsByProject((m) => ({ ...m, [projectId]: [...(m[projectId] ?? []), created] }));
      setAddingTagFor(null);
      setNewTagName("");
    } catch {
      setTagsErrorFor((e) => ({ ...e, [projectId]: "Couldn't add the tag." }));
    }
  };

  const startRenameTag = (tag: TagRecord) => {
    setRenamingTagId(tag.id);
    setRenameValue(tag.name);
  };
  const cancelRenameTag = () => {
    setRenamingTagId(null);
    setRenameValue("");
  };
  const handleRenameTag = async (tag: TagRecord) => {
    const name = renameValue.trim();
    if (!name || name === tag.name) {
      cancelRenameTag();
      return;
    }
    try {
      const updated = await renameTag(tag.id, name);
      setTagsByProject((m) => ({
        ...m,
        [tag.project_id]: (m[tag.project_id] ?? []).map((t) =>
          t.id === tag.id ? { ...t, name: updated.name } : t,
        ),
      }));
    } catch {
      setTagsErrorFor((e) => ({ ...e, [tag.project_id]: "Couldn't rename the tag." }));
    } finally {
      cancelRenameTag();
    }
  };

  const handleDeleteTag = async () => {
    const target = confirmingDeleteTag;
    if (!target) return;
    setDeletingTagId(target.id);
    try {
      await deleteTag(target.id);
      setTagsByProject((m) => ({
        ...m,
        [target.project_id]: (m[target.project_id] ?? []).filter((t) => t.id !== target.id),
      }));
      setConfirmingDeleteTag(null);
    } catch (err) {
      // Surface the server's specific reason (e.g. "last tag on enquiry")
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        "Couldn't delete the tag.";
      setTagsErrorFor((e) => ({ ...e, [target.project_id]: msg }));
      setConfirmingDeleteTag(null);
    } finally {
      setDeletingTagId(null);
    }
  };

  const handleEditSave = async (input: {
    name: string;
    clientCode: string;
    industry: string;
    status: string;
  }) => {
    if (!editing) return;
    setIsSaving(true);
    setError(null);
    try {
      const updated = await updateProject(editing.id, input);
      setProjects((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
      setEditing(null);
    } catch {
      setError("Couldn't save the project changes. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const filteredProjects = useMemo(() => {
    const clientQ = clientNameFilter.trim().toLowerCase();
    const codeQ = enquiryCodeFilter.trim().toLowerCase();
    if (!clientQ && !codeQ) return projects;
    return projects.filter((p) => {
      const matchesClient = !clientQ || (p.name ?? "").toLowerCase().includes(clientQ);
      const matchesCode = !codeQ || (p.project_code ?? "").toLowerCase().includes(codeQ);
      return matchesClient && matchesCode;
    });
  }, [projects, clientNameFilter, enquiryCodeFilter]);

  const hasFilter = clientNameFilter !== "" || enquiryCodeFilter !== "";

  const handleDelete = async () => {
    if (!confirmingDelete) return;
    const target = confirmingDelete;
    setDeletingId(target.id);
    setError(null);
    try {
      await deleteProject(target.id);
      setProjects((prev) => prev.filter((p) => p.id !== target.id));
      setConfirmingDelete(null);
    } catch {
      setError("Couldn't delete the project. Please try again.");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="projects-page">
      <div className="projects-header">
        <div className="projects-header-text">
          <h1>Enquiries</h1>
          <p>Create, open, and manage your PCP pump-selection enquiries.</p>
        </div>
        <button className="projects-new-btn" onClick={() => setIsModalOpen(true)}>
          <PlusIcon /> New Enquiry
        </button>
      </div>

      {error && (
        <div className="projects-error" role="alert">
          <AlertIcon />
          <span>{error}</span>
        </div>
      )}

      {!isLoading && !error && projects.length > 0 && (
        <div className="projects-filter-bar">
          <div className="projects-filter-field">
            <label htmlFor="filter-client-name">Client Name</label>
            <input
              id="filter-client-name"
              type="text"
              placeholder="Search by client name…"
              value={clientNameFilter}
              onChange={(e) => setClientNameFilter(e.target.value)}
            />
          </div>
          <div className="projects-filter-field">
            <label htmlFor="filter-enquiry-code">Enquiry no.</label>
            <input
              id="filter-enquiry-code"
              type="text"
              placeholder="Search by enquiry no.…"
              value={enquiryCodeFilter}
              onChange={(e) => setEnquiryCodeFilter(e.target.value)}
            />
          </div>
          {hasFilter && (
            <button
              type="button"
              className="projects-filter-clear"
              onClick={() => {
                setClientNameFilter("");
                setEnquiryCodeFilter("");
              }}
            >
              Clear
            </button>
          )}
        </div>
      )}

      {isLoading && (
        <div className="projects-panel">
          <div className="projects-loading">
            <SkeletonRows rows={5} cols={6} />
          </div>
        </div>
      )}

      {!isLoading && !error && projects.length === 0 && (
        <EmptyState
          icon="folder"
          title="No enquiries yet"
          description="Create your first enquiry to start scoping a PCP pump selection — capacity, head, media, and drive details all get saved per enquiry."
          action={
            <button className="projects-new-btn" onClick={() => setIsModalOpen(true)}>
              <PlusIcon /> Create your first enquiry
            </button>
          }
        />
      )}

      {!isLoading && !error && projects.length > 0 && filteredProjects.length === 0 && (
        <EmptyState
          icon="folder"
          title="No enquiries match this filter"
          description="Try a different client name or enquiry no., or clear the filter above."
        />
      )}

      {!isLoading && !error && filteredProjects.length > 0 && (
        <div className="projects-panel">
          <table className="projects-table">
            <thead>
              <tr>
                <th aria-label="Expand" className="projects-chevron-col" />
                <th>Enquiry no.</th>
                <th>Client Name</th>
                <th>Client Code</th>
                <th>Created By</th>
                <th className="projects-actions-col">Actions</th>
              </tr>
            </thead>

            <tbody>
              {filteredProjects.map((project) => {
                const isOpen = expanded.has(project.id);
                const tags = tagsByProject[project.id];
                const isLoadingTags = tagsLoadingFor.has(project.id);
                const tagError = tagsErrorFor[project.id];
                return (
                <React.Fragment key={project.id}>
                <tr>
                  {/* Chevron toggles the nested tag table below. Click target
                      is the whole cell so it's easy to hit; aria-expanded ties
                      the collapsed/expanded state to assistive tech. */}
                  <td className="projects-chevron-col">
                    <button
                      type="button"
                      className={`projects-chevron${isOpen ? " is-open" : ""}`}
                      onClick={() => toggleExpanded(project.id)}
                      aria-expanded={isOpen}
                      aria-label={isOpen ? "Hide tags" : "Show tags"}
                    >
                      <ChevronIcon />
                    </button>
                  </td>
                  {/* data-label feeds the stacked mobile card view, where the
                      table header row is hidden (see ProjectsPage.css). */}
                  <td className="project-code" data-label="Enquiry no.">
                    {project.project_code}
                  </td>
                  <td className="project-name" data-label="Client Name">
                    {project.name || "—"}
                  </td>
                  <td data-label="Client Code">{project.client_code || "—"}</td>
                  <td data-label="Created By">{project.created_by_name || "—"}</td>

                  <td className="projects-actions-col">
                    <div className="projects-actions">
                      <button
                        className="project-btn project-btn-primary"
                        onClick={() => openProject(project)}
                      >
                        <OpenIcon /> Open
                      </button>

                      <button
                        className="project-btn"
                        onClick={() => setEditing(project)}
                        aria-label={`Edit enquiry ${project.project_code}`}
                      >
                        <EditIcon /> Edit
                      </button>

                      <button
                        className="project-btn project-btn-danger"
                        disabled={deletingId === project.id}
                        onClick={() => setConfirmingDelete(project)}
                        aria-label={`Delete enquiry ${project.project_code}`}
                      >
                        <TrashIcon /> Delete
                      </button>
                    </div>
                  </td>
                </tr>

                {isOpen && (
                  <tr className="projects-tags-row">
                    <td />
                    <td colSpan={5}>
                      <div className="projects-tags-panel">
                        <div className="projects-tags-heading">
                          Tags on this enquiry
                          <span className="projects-tags-hint">
                            Each tag is its own pump-selection run (own wizard,
                            own MOC, own drive). Liquid and Pump Type come from
                            that tag&apos;s own inputs.
                          </span>
                        </div>

                        {isLoadingTags && (
                          <div className="projects-tags-empty">Loading tags…</div>
                        )}

                        {tagError && (
                          <div className="projects-tags-error">{tagError}</div>
                        )}

                        {!isLoadingTags && tags && tags.length === 0 && (
                          <div className="projects-tags-empty">
                            No tags yet - add one below.
                          </div>
                        )}

                        {!isLoadingTags && tags && tags.length > 0 && (
                          <table className="projects-tags-table">
                            <thead>
                              <tr>
                                <th>Tag</th>
                                <th>Liquid</th>
                                <th>Pump Type</th>
                                <th className="projects-actions-col">Actions</th>
                              </tr>
                            </thead>
                            <tbody>
                              {tags.map((tag) => {
                                const isRenaming = renamingTagId === tag.id;
                                return (
                                <tr key={tag.id}>
                                  <td>
                                    {isRenaming ? (
                                      <input
                                        type="text"
                                        className="projects-tag-input"
                                        value={renameValue}
                                        autoFocus
                                        onChange={(e) => setRenameValue(e.target.value)}
                                        onBlur={() => handleRenameTag(tag)}
                                        onKeyDown={(e) => {
                                          if (e.key === "Enter") handleRenameTag(tag);
                                          if (e.key === "Escape") cancelRenameTag();
                                        }}
                                      />
                                    ) : (
                                      <button
                                        type="button"
                                        className="projects-tag-name"
                                        onClick={() => startRenameTag(tag)}
                                        title="Click to rename"
                                      >
                                        {tag.name}
                                      </button>
                                    )}
                                  </td>
                                  <td>{tag.liquid || "—"}</td>
                                  <td>{tag.pump_type || "—"}</td>
                                  <td className="projects-actions-col">
                                    <div className="projects-actions">
                                      <button
                                        className="project-btn project-btn-primary"
                                        onClick={() => openProject(project, tag)}
                                      >
                                        <OpenIcon /> Open
                                      </button>
                                      <button
                                        className="project-btn project-btn-danger"
                                        onClick={() => setConfirmingDeleteTag(tag)}
                                        disabled={
                                          deletingTagId === tag.id ||
                                          (tags?.length ?? 0) <= 1
                                        }
                                        title={
                                          (tags?.length ?? 0) <= 1
                                            ? "Can't delete the last tag on an enquiry"
                                            : undefined
                                        }
                                        aria-label={`Delete tag ${tag.name}`}
                                      >
                                        <TrashIcon />
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        )}

                        {/* Add-tag inline form. Collapsed until the user clicks
                            "+ Add tag" so the panel stays quiet by default. */}
                        {addingTagFor === project.id ? (
                          <div className="projects-tag-add">
                            <input
                              type="text"
                              className="projects-tag-input"
                              placeholder="Tag name (e.g. Pump 1, Site A)"
                              value={newTagName}
                              autoFocus
                              maxLength={100}
                              onChange={(e) => setNewTagName(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") handleAddTag(project.id);
                                if (e.key === "Escape") cancelAddTag();
                              }}
                            />
                            <button
                              type="button"
                              className="project-btn project-btn-primary"
                              onClick={() => handleAddTag(project.id)}
                              disabled={!newTagName.trim()}
                            >
                              Add
                            </button>
                            <button
                              type="button"
                              className="project-btn"
                              onClick={cancelAddTag}
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            className="project-btn projects-tag-add-btn"
                            onClick={() => startAddTag(project.id)}
                          >
                            <PlusIcon /> Add tag
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
                </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <CreateProjectModal
        isOpen={isModalOpen}
        onClose={() => !isCreating && setIsModalOpen(false)}
        onCreate={handleCreateProject}
      />

      <EditProjectModal
        isOpen={editing !== null}
        project={editing}
        isSaving={isSaving}
        onClose={() => !isSaving && setEditing(null)}
        onSave={handleEditSave}
      />

      <ConfirmModal
        open={confirmingDelete !== null}
        title="Delete this enquiry?"
        description={
          confirmingDelete ? (
            <>
              <strong>
                {confirmingDelete.name || confirmingDelete.project_code}
              </strong>{" "}
              and its saved pump-selection inputs will be permanently removed. This
              can&apos;t be undone.
            </>
          ) : null
        }
        confirmLabel={deletingId ? "Deleting…" : "Delete project"}
        cancelLabel="Cancel"
        tone="danger"
        busy={deletingId !== null}
        onConfirm={handleDelete}
        onClose={() => !deletingId && setConfirmingDelete(null)}
      />

      <ConfirmModal
        open={confirmingDeleteTag !== null}
        title="Delete this tag?"
        description={
          confirmingDeleteTag ? (
            <>
              Tag <strong>{confirmingDeleteTag.name}</strong> and its saved
              wizard inputs (media, MOC, drive, motor picks) will be permanently
              removed. This can&apos;t be undone.
            </>
          ) : null
        }
        confirmLabel={deletingTagId ? "Deleting…" : "Delete tag"}
        cancelLabel="Cancel"
        tone="danger"
        busy={deletingTagId !== null}
        onConfirm={handleDeleteTag}
        onClose={() => !deletingTagId && setConfirmingDeleteTag(null)}
      />
    </div>
  );
};

// --- Inline icons (self-contained, no external asset dependency) -----------
// The chevron ships as a right-arrow; the .projects-chevron.is-open class in
// ProjectsPage.css rotates it 90 deg down when the row is expanded.
const ChevronIcon = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
    <path d="M4.5 3l3 3-3 3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const PlusIcon = () => (
  <svg viewBox="0 0 24 24" fill="none">
    <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
  </svg>
);

const OpenIcon = () => (
  <svg viewBox="0 0 24 24" fill="none">
    <path
      d="M9 6h10v10M19 6 6 19"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const EditIcon = () => (
  <svg viewBox="0 0 24 24" fill="none">
    <path
      d="M4 20h4L20 8l-4-4L4 16v4Z"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinejoin="round"
    />
    <path d="m14 6 4 4" stroke="currentColor" strokeWidth="1.8" />
  </svg>
);

const TrashIcon = () => (
  <svg viewBox="0 0 24 24" fill="none">
    <path
      d="M4 7h16M9 7V4h6v3M6 7l1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const AlertIcon = () => (
  <svg viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
    <path d="M12 8v4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    <circle cx="12" cy="16" r="1" fill="currentColor" />
  </svg>
);

export default ProjectsPage;
