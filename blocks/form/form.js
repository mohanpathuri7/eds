import { toCamelCase, toClassName } from '../../scripts/aem.js';

/**
 * Case-insensitive check for a "TRUE"-ish string coming from the sheet
 * (Google Sheets serializes booleans as "TRUE"/"FALSE", not "true"/"false").
 * @param {*} value
 * @returns {boolean}
 */
function isTrue(value) {
  return typeof value === 'string' && value.toLowerCase() === 'true';
}

/**
 * Case-insensitive check for an explicit "FALSE"-ish string.
 * @param {*} value
 * @returns {boolean}
 */
function isExplicitFalse(value) {
  return typeof value === 'string' && value.toLowerCase() === 'false';
}

/**
 * Creates an HTML element with an optional class name
 * @param {string} tag - HTML tag name
 * @param {string} [className] - Optional CSS class name
 * @returns {HTMLElement} Created element
 */
function createElement(tag, className) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  return el;
}

/**
 * Generates a camelCase ID from a name and optional option.
 * NOTE: ids are normalized (lowercased by toClassName). Input *names* are NOT
 * normalized, so submitted keys match the sheet's `incoming` headers exactly.
 * @param {string} name - Base name for the ID
 * @param {string} [option] - Optional value to append to the ID
 * @returns {string} Generated camelCase ID
 */
function generateId(name, option = null) {
  const id = toCamelCase(name);
  return option ? `${id}-${toCamelCase(option)}` : id;
}

/**
 * Creates a help text paragraph with a unique ID
 * @param {string} text - Help text content
 * @param {string} inputId - ID of the associated input field
 * @returns {HTMLParagraphElement} Help text element
 */
function writeHelpText(text, inputId) {
  const help = createElement('p', 'field-help-text');
  help.textContent = text;
  help.id = `${inputId}-help`;
  return help;
}

/**
 * Creates a label or legend element
 * @param {string} text - Label text content
 * @param {string} [type='label'] - Either 'label' or 'legend'
 * @param {string} [id] - ID of the associated input (for 'label' type only)
 * @param {boolean} [required] - Whether the field is required
 * @returns {HTMLElement} Label or legend element
 */
function buildLabel(text, type = 'label', id = null, required = false) {
  const label = createElement(type);
  label.textContent = text;
  if (id && type === 'label') label.setAttribute('for', id);
  if (required) label.dataset.required = 'true';
  return label;
}

/**
 * Creates an input element with specified attributes
 * @param {Object} field - Field configuration object
 * @returns {HTMLInputElement} Input element
 */
function buildInput(field) {
  const {
    type, field: fieldName, required, default: defaultValue, placeholder,
  } = field;

  const input = createElement('input');
  input.type = type || 'text';
  input.id = generateId(fieldName);
  input.name = fieldName;
  input.required = isTrue(required);
  if (defaultValue) input.value = defaultValue;
  if (placeholder) input.placeholder = placeholder;
  return input;
}

/**
 * Creates a textarea element
 * @param {Object} field - Field configuration object
 * @returns {HTMLTextAreaElement} Textarea element
 */
function buildTextArea(field) {
  const {
    field: fieldName, required, default: defaultValue, placeholder,
  } = field;

  const textarea = createElement('textarea');
  textarea.id = generateId(fieldName);
  textarea.name = fieldName;
  textarea.required = isTrue(required);
  textarea.rows = 5;
  if (defaultValue) textarea.value = defaultValue;
  if (placeholder) textarea.placeholder = placeholder;
  return textarea;
}

/**
 * Creates a radio/checkbox input for an option
 * @param {Object} field - Field configuration object
 * @param {string} option - Option value
 * @returns {HTMLInputElement} Radio/checkbox input
 */
function buildOptionInput(field, option) {
  const {
    type, field: fieldName, default: defaultValue, required,
  } = field;
  const id = generateId(fieldName, option);

  const input = createElement('input');
  input.type = type;
  input.id = id;
  input.name = fieldName;
  input.value = option;
  input.checked = option === defaultValue;
  input.required = isTrue(required);

  return input;
}

/**
 * Creates a single, standalone checkbox (e.g. a consent/agreement checkbox)
 * that has no Options list — distinct from a checkbox *group*.
 * @param {Object} field - Field configuration object
 * @param {string} controlled - Controlled field name
 * @returns {HTMLElement} Wrapper div containing the checkbox
 */
function buildSingleCheckbox(field, controlled) {
  const {
    field: fieldName, label, required, default: defaultValue, checked,
  } = field;

  const wrapper = createElement('div', 'form-field checkbox-field');
  if (controlled) {
    const controller = controlled.split('-')[0];
    wrapper.dataset.controller = controller;
    wrapper.dataset.condition = controlled;
  }

  const id = generateId(fieldName);
  const input = createElement('input');
  input.type = 'checkbox';
  input.id = id;
  input.name = fieldName;
  input.value = defaultValue || 'true';
  input.checked = isTrue(checked);
  input.required = isTrue(required);

  const span = createElement('span');
  const labelEl = buildLabel(label, 'label', id, isTrue(required));
  labelEl.prepend(input, span);
  wrapper.append(labelEl);

  return wrapper;
}

/**
 * Creates a fieldset containing radio/checkbox options
 * @param {Object} field - Field configuration object
 * @param {string} controlled - Controlled field name
 * @returns {HTMLFieldSetElement} Fieldset containing options
 */
function buildOptions(field, controlled) {
  const {
    type, options, optionNames, label, required,
  } = field;
  if (!options) return null;

  const fieldset = createElement('fieldset', `form-field ${type}-field`);
  if (controlled) {
    const controller = controlled.split('-')[0];
    fieldset.dataset.controller = controller;
    fieldset.dataset.condition = controlled;
  }
  fieldset.append(buildLabel(label, 'legend', null, isTrue(required)));

  const values = options.split(',').map((o) => o.trim());
  const names = optionNames ? optionNames.split(',').map((n) => n.trim()) : values;

  values.forEach((option, i) => {
    const optionLabel = names[i] ?? option;
    const input = buildOptionInput(field, option);
    const span = createElement('span');
    const labelEl = buildLabel(optionLabel, 'label', input.id);
    labelEl.prepend(input, span);
    fieldset.append(labelEl);
  });

  return fieldset;
}

/**
 * Fetches select options from a remote URL
 * @param {URL} url - URL to fetch options from
 * @returns {Promise<Array<HTMLOptionElement>>} Array of option elements
 */
async function buildOptionsFromUrl(url) {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`${resp.status}: ${resp.statusText}`);
  const { data } = await resp.json();
  const options = data.map((o) => {
    const option = o.option ?? o.Option;
    const value = o.value ?? o.Value;
    const optionEl = createElement('option');
    if (option && value) {
      optionEl.value = value;
      optionEl.textContent = option;
    } else if (option && !value) {
      optionEl.value = option;
      optionEl.textContent = option;
    } else if (value && !option) {
      optionEl.value = value;
      optionEl.textContent = value;
    }
    return optionEl;
  });
  return options;
}

/**
 * Creates a select dropdown field
 * @param {Object} field - Field configuration object
 * @param {string} controlled - Controlled field name
 * @returns {HTMLElement} Wrapper div containing select element
 */
function buildSelect(field, controlled) {
  const {
    type, options, optionNames, field: fieldName, label, required, placeholder,
  } = field;
  if (!options) return null;

  const wrapper = createElement('div', `form-field ${type}-field`);
  if (controlled) {
    const controller = controlled.split('-')[0];
    wrapper.dataset.controller = controller;
    wrapper.dataset.condition = controlled;
  }
  wrapper.append(buildLabel(label, 'label', generateId(fieldName), isTrue(required)));

  const select = createElement('select');
  select.id = generateId(fieldName);
  select.name = fieldName;
  select.required = isTrue(required);
  wrapper.append(select);

  if (placeholder) {
    const placeholderOption = createElement('option');
    placeholderOption.value = '';
    placeholderOption.textContent = placeholder;
    placeholderOption.disabled = true;
    placeholderOption.selected = true;
    select.append(placeholderOption);
  }

  try {
    const url = new URL(options);
    buildOptionsFromUrl(url)
      .then((os) => {
        select.append(...os);
      })
      .catch((error) => {
        // eslint-disable-next-line no-console
        console.error('Could not load options from', url.toString(), error);
        const fallback = createElement('option');
        fallback.value = '';
        fallback.textContent = 'Unable to load options';
        fallback.disabled = true;
        select.append(fallback);
      });
  } catch (error) {
    const values = options.split(',').map((o) => o.trim());
    const names = optionNames ? optionNames.split(',').map((n) => n.trim()) : values;
    values.forEach((option, i) => {
      const optionEl = createElement('option');
      optionEl.value = option;
      optionEl.textContent = names[i] ?? option;
      select.append(optionEl);
    });
  }

  return wrapper;
}

/**
 * Creates a toggle switch field (styled checkbox)
 * @param {Object} field - Field configuration object
 * @param {string} controlled - Controlled field name
 * @returns {HTMLElement} Wrapper div containing toggle switch
 */
function buildToggle(field, controlled) {
  const {
    label, required, default: defaultValue,
  } = field;

  const wrapper = createElement('div', 'form-field toggle-field');
  if (controlled) {
    const controller = controlled.split('-')[0];
    wrapper.dataset.controller = controller;
    wrapper.dataset.condition = controlled;
  }

  const input = buildOptionInput({ ...field, type: 'checkbox' }, defaultValue || 'true');
  input.setAttribute('role', 'switch');
  input.setAttribute('aria-checked', input.checked);

  input.addEventListener('change', () => {
    input.setAttribute('aria-checked', input.checked);
  });

  const span = createElement('span');
  const labelEl = buildLabel(label, 'label', input.id, isTrue(required));
  labelEl.prepend(input, span);
  wrapper.append(labelEl);

  return wrapper;
}

/**
 * Creates a button element
 * @param {Object} field - Field configuration object
 * @returns {HTMLButtonElement} Button element
 */
function buildButton(field) {
  const { type, label } = field;
  const button = createElement('button');
  button.className = 'button';
  button.type = type;
  button.textContent = label;
  if (type === 'reset') button.classList.add('secondary');
  return button;
}

/**
 * Updates visibility and validation state for a conditional field and all of
 * its controls.
 * @param {HTMLElement} field - The conditional field wrapper
 * @param {boolean} visible - Whether the field should be visible
 */
function setConditionalFieldVisibility(field, visible) {
  field.setAttribute('aria-hidden', !visible);
  [...field.querySelectorAll('input, textarea, select')].forEach((input) => {
    if (input.hasAttribute('required')) input.dataset.originalRequired = 'true';

    if (visible) {
      if (input.dataset.originalRequired === 'true') input.setAttribute('required', '');
      input.removeAttribute('tabindex');
    } else {
      input.removeAttribute('required');
      input.setAttribute('tabindex', '-1');
    }
  });
}

/**
 * Toggles visibility of conditional fields based on the selected input
 * @param {Event} e - Change event
 * @param {Map} controllerConfig - Map of controller names to controlled fields
 */
function toggleConditional(e, controllerConfig) {
  const { target } = e;
  const controller = target.name;
  // check if this is a controlling input
  if (controllerConfig.has(controller)) {
    const fields = controllerConfig.get(controller);
    fields.forEach((field) => {
      const { condition } = field.dataset;
      const conditionMet = condition.includes(toClassName(target.value));
      setConditionalFieldVisibility(field, conditionMet);
    });
  }
}

/**
 * Sets initial visibility of conditional fields based on default values.
 * @param {HTMLFormElement} form - Form element
 * @param {Map} controllerConfig - Map of controller names to controlled fields.
 */
function initConditionals(form, controllerConfig) {
  // for each controller, find its current value and apply conditions
  controllerConfig.forEach((controlledInputs, controller) => {
    // find the controlling input - could be radio/checkbox or select
    let controllerValue = null;
    const checked = form.querySelector(`[name="${controller}"]:checked`);
    const select = form.querySelector(`select[name="${controller}"]`);

    if (checked) {
      controllerValue = checked.value;
    } else if (select) {
      controllerValue = select.value;
    }

    if (controllerValue) {
      // set correct visibility for each controlled field
      controlledInputs.forEach((field) => {
        const { condition } = field.dataset;
        const conditionMet = condition.includes(toClassName(controllerValue));
        setConditionalFieldVisibility(field, conditionMet);
      });
    } else {
      // if no input is checked, hide all controlled fields
      controlledInputs.forEach((field) => setConditionalFieldVisibility(field, false));
    }
  });
}

/**
 * Sets up conditional field visibility and ARIA relationships
 * @param {HTMLFormElement} form - Form element
 */
function enableConditionals(form) {
  // find controlled fields
  const controlled = [...form.querySelectorAll('[data-controller]')];

  // create a map of controller names to controlled fields
  const controllerConfig = new Map();

  controlled.forEach((c) => {
    const { controller } = c.dataset;

    // Track the whole field so grouped controls share visibility and validity.
    if (!controllerConfig.has(controller)) controllerConfig.set(controller, []);
    controllerConfig.get(controller).push(c);

    // set up aria relationships
    const inputs = [...c.querySelectorAll('input, textarea, select')];
    inputs.forEach((input) => {
      if (!input.id) return;

      // find the controlling input(s)
      const controllerInputs = form.querySelectorAll(`[name="${controller}"]`);

      // set aria-controls on controlling inputs
      controllerInputs.forEach((controllerInput) => {
        // get existing aria-controls or initialize empty
        const existingControls = controllerInput.getAttribute('aria-controls') || '';
        const controlsArray = existingControls.split(' ').filter((ec) => ec);

        // add this input's id if not already present
        if (!controlsArray.includes(input.id)) {
          controlsArray.push(input.id);
        }

        // update aria-controls attribute
        controllerInput.setAttribute('aria-controls', controlsArray.join(' '));

        // set aria-controlledby on the controlled input
        input.setAttribute('aria-controlledby', controllerInput.id);
      });
    });
  });

  // initialize conditional visibility
  initConditionals(form, controllerConfig);

  // add single event listener for ALL controlling inputs
  form.addEventListener('change', (e) => {
    toggleConditional(e, controllerConfig);
  });
}

/**
 * Enables or disables all form elements
 * @param {HTMLFormElement} form - Form element
 * @param {boolean} [disabled=true] - Whether to disable the form
 */
function toggleForm(form, disabled = true) {
  [...form.elements].forEach((el) => {
    el.disabled = disabled;
  });
}

/**
 * Generates form submission payload from form elements.
 * File inputs are skipped: a spreadsheet can't store an uploaded file, and the
 * browser would otherwise submit a meaningless fake path.
 * @param {HTMLFormElement} form - Form element
 * @returns {Object} Payload object with form data
 */
function generatePayload(form) {
  const payload = {};
  [...form.elements].forEach((field) => {
    if (field.name && !field.disabled && field.type !== 'file') {
      if (field.type === 'radio') {
        if (field.checked) payload[field.name] = field.value;
      } else if (field.type === 'checkbox') {
        if (field.checked) payload[field.name] = payload[field.name] ? `${payload[field.name]},${field.value}` : field.value;
      } else {
        payload[field.name] = field.value;
      }
    }
  });
  return payload;
}

/**
 * Displays submission feedback to the user.
 * @param {HTMLFormElement} form - Form element
 * @param {string} message - Feedback text
 * @param {boolean} [isError=false] - Whether the message reports an error
 */
function showFormMessage(form, message, isError = false) {
  let status = form.querySelector('.form-message');
  if (!status) {
    status = createElement('p', 'form-message');
    form.append(status);
  }
  status.textContent = message;
  status.setAttribute('role', isError ? 'alert' : 'status');
  status.classList.toggle('error', isError);
}

/**
 * Clears the form after a successful submission: empties all fields, removes
 * extra repeatable fieldset entries and clears any leftover validation errors.
 * @param {HTMLFormElement} form - Form element
 */
function resetForm(form) {
  form.reset();
  [...form.querySelectorAll('.fieldset-field')].forEach((fs) => {
    fs.dispatchEvent(new Event('reset-instances'));
  });
  [...form.querySelectorAll('[aria-invalid="true"]')].forEach((el) => {
    el.removeAttribute('aria-invalid');
  });
  [...form.querySelectorAll('.field-error')].forEach((el) => el.remove());
}

/**
 * Handles form submission
 * @param {HTMLFormElement} form - Form element to submit
 * @returns {Promise<void>}
 */
async function handleSubmit(form) {
  try {
    // build the payload BEFORE disabling the form (disabled fields are skipped)
    const payload = generatePayload(form);
    toggleForm(form);
    const response = await fetch(form.dataset.action, {
      method: 'POST',
      body: JSON.stringify({ data: payload }),
      // text/plain avoids the CORS preflight request, which Google Apps Script
      // web apps cannot answer. The script still parses the body as JSON.
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
    });
    if (response.ok) {
      if (form.dataset.confirmation) {
        window.location.href = form.dataset.confirmation;
      } else {
        resetForm(form);
        showFormMessage(form, form.dataset.successMessage || 'Your submission was received.');
      }
    } else {
      const error = await response.text();
      throw new Error(`${response.status}: ${error}`);
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Form submission failed:', error);
    showFormMessage(form, 'We could not submit your form. Please try again.', true);
  } finally {
    toggleForm(form, false);
  }
}

/**
 * Shows a visible error message under an invalid field and marks it invalid.
 * @param {HTMLElement} input - The invalid form control
 */
function showFieldError(input) {
  input.setAttribute('aria-invalid', 'true');
  let error = input.nextElementSibling;
  if (!error || !error.classList.contains('field-error')) {
    error = createElement('p', 'field-error');
    error.setAttribute('role', 'alert');
    input.insertAdjacentElement('afterend', error);
  }
  error.id = error.id || `${input.id || 'field'}-error`;
  error.textContent = input.validationMessage || 'This field is invalid.';

  const describedBy = (input.getAttribute('aria-describedby') || '').split(' ').filter(Boolean);
  if (!describedBy.includes(error.id)) {
    describedBy.push(error.id);
    input.setAttribute('aria-describedby', describedBy.join(' '));
  }
}

/**
 * Clears a previously shown field error, if any.
 * @param {HTMLElement} input - The form control to clear
 */
function clearFieldError(input) {
  input.removeAttribute('aria-invalid');
  const error = input.nextElementSibling;
  if (error && error.classList.contains('field-error')) {
    const describedBy = (input.getAttribute('aria-describedby') || '')
      .split(' ')
      .filter((id) => id && id !== error.id);
    if (describedBy.length) {
      input.setAttribute('aria-describedby', describedBy.join(' '));
    } else {
      input.removeAttribute('aria-describedby');
    }
    error.remove();
  }
}

/**
 * Sets up form submission handler
 * @param {HTMLFormElement} form - Form element
 * @param {string} submit - Submit URL
 * @param {Array<Object>} fields - Array of field configurations
 */
function enableSubmission(form, submit, fields) {
  if (submit) form.dataset.action = submit;
  const confirmation = fields.find((f) => f.type === 'confirmation');
  if (confirmation) {
    form.dataset.confirmation = confirmation.label || confirmation.default;
  }
  // the Placeholder of the submit row is used as the thank-you message
  const submitField = fields.find((f) => f.type === 'submit');
  if (submitField && submitField.placeholder) {
    form.dataset.successMessage = submitField.placeholder;
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();

    // clear any stale errors from a previous attempt before re-checking
    [...form.querySelectorAll('[aria-invalid="true"]')].forEach((el) => clearFieldError(el));

    const valid = form.reportValidity();

    if (valid) {
      if (!form.dataset.action) {
        showFormMessage(form, 'This form is not configured to submit. Please contact the site owner.', true);
        return;
      }
      handleSubmit(form);
      return;
    }

    const invalidFields = [...form.querySelectorAll(':invalid')]
      .filter((el) => el.tagName !== 'FIELDSET');
    invalidFields.forEach((el) => showFieldError(el));

    const firstInvalid = invalidFields[0];
    if (firstInvalid) {
      firstInvalid.focus();
      firstInvalid.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  });

  // clear the error as soon as the field becomes valid again
  form.addEventListener('input', (e) => {
    if (e.target.hasAttribute('aria-invalid') && e.target.validity.valid) {
      clearFieldError(e.target);
    }
  });
  form.addEventListener('change', (e) => {
    if (e.target.hasAttribute('aria-invalid') && e.target.validity.valid) {
      clearFieldError(e.target);
    }
  });
}

/**
 * Creates a form field based on field configuration
 * @param {Object} field - Field configuration object
 * @returns {HTMLElement} Form field element (fieldset, div, or button)
 */
function buildField(field) {
  const {
    type, label, help, field: fieldName, conditional, visible,
  } = field;
  const controlled = conditional || null;

  // fields explicitly marked Visible=FALSE become hidden inputs, not rendered fields
  if (isExplicitFalse(visible)) {
    const hidden = createElement('input');
    hidden.type = 'hidden';
    hidden.id = generateId(fieldName);
    hidden.name = fieldName;
    if (field.default) hidden.value = field.default;
    return hidden;
  }

  // submit/reset buttons stand alone
  if (type === 'submit' || type === 'reset') {
    return buildButton(field);
  }

  // radio/checkbox groups get a fieldset; a checkbox with no Options is a
  // standalone agreement-style checkbox (e.g. a consent checkbox)
  if (type === 'radio' || type === 'checkbox') {
    if (type === 'checkbox' && !field.options) {
      const single = buildSingleCheckbox(field, controlled);
      if (help) {
        const helpText = writeHelpText(help, generateId(fieldName));
        single.append(helpText);
      }
      return single;
    }
    const fieldset = buildOptions(field, controlled);
    if (!fieldset) {
      // eslint-disable-next-line no-console
      console.error(`Radio field "${fieldName}" has no Options configured`);
      return null;
    }
    if (help) {
      const helpText = writeHelpText(help, generateId(fieldName));
      fieldset.append(helpText);
    }
    return fieldset;
  }

  if (type === 'toggle') {
    const toggle = buildToggle(field, controlled);
    if (help) {
      const helpText = writeHelpText(help, generateId(fieldName));
      toggle.append(helpText);
    }
    return toggle;
  }

  if (type === 'select') {
    const select = buildSelect(field, controlled);
    if (help) {
      const helpText = writeHelpText(help, generateId(fieldName));
      select.append(helpText);
    }
    return select;
  }

  // inputs and textareas get a wrapper div
  const wrapper = createElement('div', `form-field ${type}-field`);
  if (controlled) {
    const controller = controlled.split('-')[0];
    wrapper.dataset.controller = controller;
    wrapper.dataset.condition = controlled;
  }
  const inputId = generateId(fieldName);
  wrapper.append(buildLabel(label, 'label', inputId, isTrue(field.required)));

  // create help text first to get id
  let helpText;
  if (help) {
    helpText = writeHelpText(help, inputId);
    wrapper.append(helpText);
  }

  const input = type === 'textarea' ? buildTextArea(field) : buildInput(field);

  if (type === 'textarea') {
    wrapper.append(input);
  } else {
    wrapper.insertBefore(input, wrapper.firstChild.nextSibling);
  }

  if (help) input.setAttribute('aria-describedby', helpText.id);

  return wrapper;
}

/**
 * Builds one repeatable "instance" of a fieldset's child fields.
 * The first instance keeps the original field names (so they match the sheet's
 * `incoming` headers); additional instances get a numeric suffix (_1, _2, ...).
 * @param {Array<Object>} childFields - Field configs belonging to this fieldset
 * @param {number} index - Instance index (0-based)
 * @param {boolean} removable - Whether to show a "Remove" button on this instance
 * @returns {HTMLElement} Wrapper div for this instance
 */
function buildFieldsetInstance(childFields, index, removable) {
  const instance = createElement('div', 'fieldset-instance');

  childFields.forEach((child) => {
    const indexedField = index === 0
      ? { ...child }
      : { ...child, field: `${child.field}_${index}` };
    const el = buildField(indexedField);
    if (el) instance.append(el);
  });

  if (removable) {
    const removeBtn = createElement('button', 'remove-instance');
    removeBtn.type = 'button';
    removeBtn.textContent = 'Remove';
    removeBtn.addEventListener('click', () => instance.remove());
    instance.append(removeBtn);
  }

  return instance;
}

/**
 * Builds a <fieldset> grouping its child fields, with support for the
 * Repeatable column (an "Add another" button that clones the child fields).
 * @param {Object} field - The fieldset's own field configuration
 * @param {Array<Object>} childFields - Field configs whose Fieldset column matches this one
 * @returns {HTMLFieldSetElement} The built fieldset
 */
function buildFieldsetField(field, childFields) {
  const { label, required, repeatable } = field;

  const fieldset = createElement('fieldset', 'form-field fieldset-field');
  fieldset.append(buildLabel(label, 'legend', null, isTrue(required)));

  const instancesWrapper = createElement('div', 'fieldset-instances');
  fieldset.append(instancesWrapper);

  let count = 0;
  const addInstance = () => {
    const removable = isTrue(repeatable) && count > 0;
    instancesWrapper.append(buildFieldsetInstance(childFields, count, removable));
    count += 1;
  };
  addInstance(); // always start with exactly one instance

  // lets resetForm() put the fieldset back to a single empty instance
  fieldset.addEventListener('reset-instances', () => {
    instancesWrapper.replaceChildren();
    count = 0;
    addInstance();
  });

  if (isTrue(repeatable)) {
    const addBtn = createElement('button', 'add-instance');
    addBtn.type = 'button';
    addBtn.textContent = '+ Add another';
    addBtn.addEventListener('click', addInstance);
    fieldset.append(addBtn);
  }

  return fieldset;
}

/**
 * Creates a complete form from field configurations
 * @param {Array<Object>} fields - Array of field configurations
 * @param {string} submit - Submit URL
 * @returns {HTMLFormElement} Complete form element
 */
function buildForm(fields, submit) {
  const form = createElement('form');
  form.setAttribute('novalidate', '');

  // group buttons at the end
  const buttons = [];

  // group child fields (rows whose Fieldset column is set) by their parent fieldset name
  const childrenByFieldset = new Map();
  fields.forEach((f) => {
    if (f.fieldset) {
      if (!childrenByFieldset.has(f.fieldset)) childrenByFieldset.set(f.fieldset, []);
      childrenByFieldset.get(f.fieldset).push(f);
    }
  });
  const fieldsetNames = new Set(fields.filter((f) => f.type === 'fieldset').map((f) => f.field));

  fields.forEach((field) => {
    if (field.type === 'submit' || field.type === 'reset') {
      buttons.push(field);
    } else if (field.type === 'confirmation') {
      // handled separately in enableSubmission
    } else if (field.type === 'fieldset') {
      const children = childrenByFieldset.get(field.field) || [];
      form.append(buildFieldsetField(field, children));
    } else if (field.fieldset && fieldsetNames.has(field.fieldset)) {
      // this field is rendered inside its parent fieldset above; skip standalone
    } else {
      const el = buildField(field);
      if (el) form.append(el);
    }
  });

  // add buttons in a wrapper (if any)
  if (buttons.length) {
    const buttonWrapper = createElement('div', 'button-wrapper');
    buttons.forEach((button) => buttonWrapper.append(buildField(button)));
    form.append(buttonWrapper);
  }

  enableConditionals(form);

  enableSubmission(form, submit, fields);

  return form;
}

/**
 * Normalizes form rows returned by the AEM Forms JSON endpoint.
 * @param {Array<Object>} fields - Raw form field rows
 * @returns {Array<Object>} Fields in the format expected by the form builder
 */
function normalizeFields(fields) {
  return fields.map((field) => ({
    ...field,
    field: field.field ?? field.Name,
    type: (field.type ?? field.Type)?.toLowerCase(),
    label: field.label ?? field.Label,
    placeholder: field.placeholder ?? field.Placeholder,
    default: field.default ?? field.Value,
    required: field.required ?? field.Mandatory,
    options: field.options ?? field.Options,
    optionNames: field.optionNames ?? field.OptionNames,
    checked: field.checked ?? field.Checked,
    visible: field.visible ?? field.Visible,
    fieldset: field.fieldset ?? field.Fieldset,
    repeatable: field.repeatable ?? field.Repeatable,
  }));
}

/**
 * Derives the submit URL from the form definition URL when no second link is
 * given: /forms/contact-us.json -> /forms/contact-us
 * @param {string} source - Form definition (.json) URL
 * @returns {string} Submit URL
 */
function defaultSubmitUrl(source) {
  const url = new URL(source, window.location.origin);
  url.pathname = url.pathname.replace(/\.json$/, '');
  url.search = '';
  return url.toString();
}

/**
 * Initializes form block with data from JSON endpoint
 * @param {HTMLElement} block - Form block element
 */
export default function decorate(block) {
  block.style.visibility = 'hidden';
  const [source, submit] = [...block.querySelectorAll('a[href]')].map((a) => a.href);
  if (source) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(async (entry) => {
        if (entry.isIntersecting) {
          try {
            const resp = await fetch(new URL(source, window.location.origin));
            if (!resp.ok) throw new Error(`${resp.status}: ${resp.statusText}`);
            const { data } = await resp.json();
            if (!data) throw new Error(`No form fields at ${source}`);
            const action = submit || defaultSubmitUrl(source);
            const form = buildForm(normalizeFields(data), action);
            block.replaceChildren(form);
            block.removeAttribute('style');
          } catch (error) {
            // eslint-disable-next-line no-console
            console.error('Could not build form from', source, error);
            block.parentElement.remove();
          }
          observer.disconnect();
        }
      });
    }, { threshold: 0 });

    observer.observe(block);
  } else {
    // eslint-disable-next-line no-console
    console.error('Unable to create form without source');
    block.parentElement.remove();
  }
}
