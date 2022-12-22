document.addEventListener('DOMContentLoaded', event => {
  function arrangeTags(contacts) {
    return contacts.map(contact => {
      contact.tags = contact.tags ? contact.tags.split(',').sort() : null;
      return contact;
    })
  }

  class ContactHandler {
    constructor() {
      this.contacts = [];
      this.tags = [];
    }
    async init() {
      await this.loadContacts();
    }
    async loadContacts() {
      let url = '/api/contacts';
      let method = 'get';
      let response = await fetch(url, { method });
      let contacts = await response.json();
      updateContactsAndTags.apply(this, [contacts]);
    }
    getContacts() {
      return JSON.parse(JSON.stringify(this.contacts))
    }
    getFilteredContacts(search, tags) {
      let contacts = this.getContacts();
      return contacts.filter(contact => {
        if (search) {
          if (!contact.full_name.toLowerCase().includes(search.toLowerCase())) return false;
        }
        if (tags && tags.length > 0) {
          if (!contact.tags) return false;
          for (let i = 0; i < tags.length; i += 1) {
            let tag = tags[i];
            if (!contact.tags.includes(tag)) return false;
          }
        }
        return true;
      })
    }
    getContact(id) {
      let contact = this.contacts.filter(contact => contact.id == id)[0];
      return JSON.parse(JSON.stringify(contact))
    }
    getTags() {
      return [...this.tags];
    }
  }

  function updateContactsAndTags(contacts) {
    this.contacts = arrangeTags(contacts);
    let tagArray = contacts.map(contact => contact.tags)
      .filter(tag => tag)
      .join(',')
      .split(',')
      .filter((tag, index, array) => {
        return array.indexOf(tag) === index;
      });
    this.tags = tagArray.sort();
  }

  class ContactsApplication {
    constructor() {
      this.templates = createTemplates();
      this.contacts = new ContactHandler()
      this.searchBar = document.querySelector('#search');
      this.tagFilterWrap = document.querySelector('#tag-filter-wrapper');
      this.contactListWrap = document.querySelector('#contact-list-wrapper');
      this.newContactWrap = document.querySelector('#new-contact-wrapper');
      this.editContactWrap = document.querySelector('#edit-contact-wrapper');
      this.newContact = document.querySelector('#add-contact');
      this.cancelButtons = Array.from(document.querySelectorAll('.cancel'));
      this.forms = Array.from(document.querySelectorAll('form'));
      this.bindEvents();
    }
    async init() {
      await this.contacts.init();
      let contacts = this.contacts.getContacts();
      this.showContacts(contacts);
      this.showTags();
    }

    showTags() {
      let tags = this.contacts.getTags();
      let tagsTemplate = this.templates['tags-template'];
      let tagshtml = tagsTemplate({ tags });
      this.tagFilterWrap.innerHTML = tagshtml;
    }

    showContacts(contacts = this.contacts.getContacts()) {
      let contactsTemplate = this.templates['contacts-template'];
      let contactshtml = contactsTemplate({ contacts });
      let contactsWrap = document.querySelector('#contacts-wrapper');
      contactsWrap.innerHTML = contactshtml;
      this.contactListWrap.classList.remove('hidden');
      this.newContactWrap.classList.add('hidden');
      this.editContactWrap.classList.add('hidden');
    }

    bindEvents() {
      this.newContact.addEventListener('click', handleNewContact.bind(this));
      this.cancelButtons.forEach(button => {
        button.addEventListener('click', handleCancel.bind(this));
      });
      this.contactListWrap.addEventListener('click', handleContactClicks.bind(this));
      this.newContactWrap.addEventListener('click', handleNewEditTagClicks.bind(this));
      this.editContactWrap.addEventListener('click', handleNewEditTagClicks.bind(this));
      this.forms.forEach(form => form.addEventListener('submit', handleSubmit.bind(this)))
      this.tagFilterWrap.addEventListener('click', tagFilterHandler.bind(this));
      this.searchBar.addEventListener('input', filterContacts.bind(this));
    }
  }

  function createTemplates() {
    let templates = {};
    document.querySelectorAll('.full-template').forEach(templateElement => {
      let id = templateElement.id;
      templates[id] = Handlebars.compile(templateElement.innerHTML);
    })
    document.querySelectorAll('.partial-template').forEach(templateElement => {
      let id = templateElement.id;
      Handlebars.registerPartial(id, templateElement.innerHTML);
    })
    return templates;
  }

  async function handleContactClicks(event) {
    if (event.target.matches('button')) {
      let button = event.target;
      let id = button.dataset.id;
      event.preventDefault();
      if (button.classList.contains('edit')) {
        populateAndShowEdit.apply(this, [id])
      } else if (button.classList.contains('delete')) {
        if (confirm('Do you want to delete contact?')) {
          let url = `/api/contacts/${id}`;
          let options = { method: 'DELETE' };
          let response = await fetch(url, options);
          if (response.status === 204) {
            await this.contacts.loadContacts();
            this.showContacts();
            this.showTags();
          }
        }
      }
    }
  }

  function populateAndShowEdit(id) {
    let contact = this.contacts.getContact(id);
    let form = document.querySelector('#edit-form');
    form.setAttribute('action', `/api/contacts/${id}`)
    let formData = new FormData(form);
    for (let [key, value] of formData) {
      let input = form.querySelector(`[name="${key}`);
      input.value = contact[key];
    }
    let tagWrapper = form.querySelector('.tag-wrapper');
    let allTags = this.contacts.getTags();
    tagWrapper.innerHTML = generateTagsHTML.apply(this, [allTags]);
    if (contact.tags && contact.tags.length > 0) {
      let tagElements = Array.from(tagWrapper.querySelectorAll('button')).slice(0, -1);
      tagElements.forEach(tagElement => {
        if (contact.tags.includes(tagElement.dataset.tag)) tagElement.classList.add('selected');
      })
    }
    

    this.contactListWrap.classList.add('hidden');
    this.editContactWrap.classList.remove('hidden');
  }

  function handleNewContact() {
    this.contactListWrap.classList.add('hidden');
    this.newContactWrap.classList.remove('hidden');
    let tagWrapper = this.newContactWrap.querySelector('.tag-wrapper');
    tagWrapper.innerHTML = generateTagsHTML.apply(this);
  }

  function handleNewEditTagClicks(event) {
    if (event.target.matches('button')) {
      event.preventDefault();
      let button = event.target;
      if (button.classList.contains('tag')) {
        if (button.classList.contains('new-tag')) {
          handleNewTagClick.apply(this, [event]);
        } else {
          button.classList.toggle('selected');
        }
      }
    }
  }

  function tagFilterHandler(event) {
    event.target.classList.toggle('selected');
    filterContacts.apply(this);
  }

  function handleNewTagClick(event) {
    let newTagButton = event.target;
    let tagName = prompt("What is the new tag name?");
    if (tagName) {
      let template = this.templates['tags-template'];
      let html = template({ tags: [tagName] });
      let wrapper = document.createElement('div');
      wrapper.innerHTML = html;
      let tag = wrapper.firstElementChild;
      newTagButton.insertAdjacentElement('beforebegin', tag);
    }
  };

  async function handleSubmit(event) {
    event.preventDefault();
    let form = event.target;
    let valid = validateForm(form);
    if (valid) {
      let url = form.getAttribute('action');
      let method = form.getAttribute('method');
      let formData = formDataToObject(new FormData(form));
      let tags = form.querySelectorAll('.tag');
      formData.tags = extractSelectedTags(tags).join(',');
      let options = {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData)
      }
      let response = await fetch(url, options);
      if (response.status === 201) {
        await this.contacts.loadContacts();
        this.showContacts();
        this.showTags();
      }
    }
  }

  function handleCancel(event) {
    let form = event.currentTarget.parentElement;
    form.reset();
    let errorMessages = form.querySelectorAll('.error');
    errorMessages.forEach(errorMessage => errorMessage.textContent = '');
    form.parentElement.classList.add('hidden');
    this.contactListWrap.classList.remove('hidden');
  }


  function generateTagsHTML(tags = this.contacts.tags) {
    let template = this.templates['tags-template'];
    return template({ tags, new: true });
  }

  function validateForm(form) {
    let inputs = form.querySelectorAll('input[type="text"');
    let result = true;
    inputs.forEach(input => {
      if (input.validity.valueMissing) {
        input.nextElementSibling.textContent = 'This is required';
        result = false;
      } else if (input.validity.patternMismatch) {
        input.nextElementSibling.textContent = 'This does not match the required pattern';
        result = false;
      } else {
        input.nextElementSibling.textContent = '';
      }
    })
    return result;
  }

  function extractSelectedTags(tagElements) {
    let tags = [];
    tagElements.forEach(tag => {
      if (tag.classList.contains('selected')) tags.push(tag.dataset.tag);
    })
    return tags;
  }

  function formDataToObject(formData) {
    let result = {};
    for (let [key, value] of formData) {
      result[key] = value;
    }
    return result;
  }

  function filterContacts() {
    let selectedTags = extractSelectedTags(this.tagFilterWrap.querySelectorAll('.tag'));
    let search = this.searchBar.value;
    let contacts = this.contacts.getFilteredContacts(search, selectedTags);
    this.showContacts(contacts);
  }


  let app = new ContactsApplication();
  app.init();
})