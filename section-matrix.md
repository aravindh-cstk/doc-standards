# Section Matrix: Required vs Optional by Doc Type

Reference table for all doc types. Use this alongside the per-type file to know which sections are required for the doc you are reviewing or writing.

The four CLI types live in `cli-templates/`. They are separate types rather than variants of Feature Doc or How-To Guide because their required sections differ, and because a Section Order row cannot be scoped to one product.

| Section | Get Started Guide | Conceptual Guide | Feature Doc | How-To Guide | Setup Guide | Kickstarter | Migration Guide | CLI Command Reference | CLI Task Runbook | CLI Module Reference | CLI Plugin Guide |
|---|---|---|---|---|---|---|---|---|---|---|---|
| SEO front matter | Required | Required | Required | Required | Required | Required | Required (include version field) | Required | Required | Required | Required |
| Overview | Required (2-3 sentences only) | Required | Required | Required | Required | Required | Required (use migration pattern) | Required | Required | Required | Required |
| Role-Based Routing Table | Required | Not used | Not used | Not used | Not used | Not used | Not used | Not used | Not used | Not used | Not used |
| Quick Decision Guide | Not used | If multiple paths | If multiple approaches | Rarely | If multiple environments | Rarely | If multiple migration paths exist | Not used | If the operation has more than one path | Not used | Not used |
| Quick Reference | Not used | Optional | Optional | Optional | Optional | Not used | Optional | If the doc covers 3 or more commands | Not used | Required | Not used |
| Prerequisites | Required (Quick Start path only) | If setup involved | If setup involved | Required | Required | Required | Required | Required | Required | Not used | Required |
| Quick Start | Required | Not used | Not used | Not used | Not used | Not used | Not used | Not used | Not used | Not used | Not used |
| Documentation Map | Required | Not used | Not used | Not used | Not used | Not used | Not used | Not used | Not used | Not used | Not used |
| Installation | Not used | Not used | Not used | Not used | Not used | Not used | Not used | Required if the plugin is not bundled | Not used | Not used | Not used |
| Type Mapping Reference | Not used | Not used | Not used | Not used | Not used | Not used | Required if API surface changes | Not used | Not used | Not used | Not used |
| Main Content | Not used | Required | Required | Required | Required | Required | Required (Before/After per subsection) | Not used | Not used | Required | Not used |
| Commands | Not used | Not used | Not used | Not used | Not used | Not used | Required if the guide covers a command-line tool | Required | Not used | Not used | Not used |
| Steps for Execution | Not used | Not used | Not used | Not used | Not used | Not used | Not used | Not used | Required | Not used | Not used |
| Theory Sections | Not used | Common | Common | Rare | Rare | Not used | Not used | Not used | Not used | Not used | Not used |
| Gradual Migration | Not used | Not used | Not used | Not used | Not used | Not used | Required if partial path exists | Not used | Not used | Not used | Not used |
| Troubleshooting | Not used | Recommended | Required | Optional | Required | Optional | Required | Not used | Not used | Not used | Not used |
| Limitations | Not used | Optional | Optional | Optional | Optional | Not used | Optional | Required | Required | Not used | Recommended |
| Pre-Upgrade Checklist | Not used | Not used | Not used | Not used | Not used | Not used | Required | Not used | Not used | Not used | Not used |
| Next Steps | Required | Required | Required | Required | Required | Required | Required | Recommended | Recommended | Recommended | Required |
| Plugin Structure | Not used | Not used | Not used | Not used | Not used | Not used | Not used | Not used | Not used | Not used | Required |
| Creating a Plugin | Not used | Not used | Not used | Not used | Not used | Not used | Not used | Not used | Not used | Not used | Required |
| Plugin Registration and Linking | Not used | Not used | Not used | Not used | Not used | Not used | Not used | Not used | Not used | Not used | Required |
| Commands and Flags | Not used | Not used | Not used | Not used | Not used | Not used | Not used | Not used | Not used | Not used | Required |
| Testing | Not used | Not used | Not used | Not used | Not used | Not used | Not used | Not used | Not used | Not used | Recommended |
| Publishing | Not used | Not used | Not used | Not used | Not used | Not used | Not used | Not used | Not used | Not used | Required |
| Managing Installed Plugins | Not used | Not used | Not used | Not used | Not used | Not used | Not used | Not used | Not used | Not used | Recommended |
| Available Methods and Utilities | Not used | Not used | Not used | Not used | Not used | Not used | Not used | Not used | Not used | Not used | Optional |
