function initCvPage() {
  var navLinks = Array.prototype.slice.call(document.querySelectorAll(".site-nav a"));
  var sections = navLinks
    .map(function (link) {
      return document.querySelector(link.getAttribute("href"));
    })
    .filter(Boolean);

  var revealElements = Array.prototype.slice.call(document.querySelectorAll(".reveal"));
  var yearNode = document.getElementById("currentYear");
  var copyEmailButton = document.getElementById("copyEmailButton");
  var downloadPdfButton = document.getElementById("downloadPdfButton");
  var mobileNavToggle = document.getElementById("mobileNavToggle");
  var siteNav = document.getElementById("siteNav");
  var avatarPreviewOpen = document.getElementById("avatarPreviewOpen");
  var avatarLightbox = document.getElementById("avatarLightbox");
  var avatarLightboxDialog = avatarLightbox
    ? avatarLightbox.querySelector(".image-lightbox__dialog")
    : null;
  var avatarLightboxImage = avatarLightbox
    ? avatarLightbox.querySelector(".image-lightbox__image")
    : null;
  var avatarLightboxClose = document.getElementById("avatarLightboxClose");
  var avatarLightboxBackdrop = avatarLightbox
    ? avatarLightbox.querySelector("[data-lightbox-close]")
    : null;
  var prefersReducedMotion = typeof window.matchMedia === "function"
    ? window.matchMedia("(prefers-reduced-motion: reduce)")
    : { matches: false };

  var lastFocusedElement = null;
  var activeAvatarClone = null;

  function closeMobileNav() {
    if (siteNav) {
      siteNav.classList.remove("is-open");
    }

    if (mobileNavToggle) {
      mobileNavToggle.setAttribute("aria-expanded", "false");
    }

    document.body.classList.remove("is-mobile-nav-open");
  }

  function openMobileNav() {
    if (siteNav) {
      siteNav.classList.add("is-open");
    }

    if (mobileNavToggle) {
      mobileNavToggle.setAttribute("aria-expanded", "true");
    }

    document.body.classList.add("is-mobile-nav-open");
  }

  function decodeEmailPart(attributeName) {
    var rawValue = copyEmailButton ? copyEmailButton.getAttribute(attributeName) : "";

    if (!rawValue) {
      return "";
    }

    return rawValue
      .split(",")
      .map(function (code) {
        return String.fromCharCode(Number(code));
      })
      .join("");
  }

  function buildEmailAddress() {
    var user = decodeEmailPart("data-email-user");
    var domain = decodeEmailPart("data-email-domain");
    var tld = decodeEmailPart("data-email-tld");

    if (!user || !domain || !tld) {
      return "";
    }

    return user + "@" + domain + "." + tld;
  }

  if (yearNode) {
    yearNode.textContent = "© " + new Date().getFullYear() + " Michal Zemek";
  }

  if (copyEmailButton) {
    var decodedEmail = buildEmailAddress();

    if (decodedEmail) {
      copyEmailButton.textContent = decodedEmail;
      copyEmailButton.setAttribute("href", "mailto:" + decodedEmail);
      copyEmailButton.setAttribute("data-email", decodedEmail);
      copyEmailButton.setAttribute("aria-label", "Napsat e-mail na " + decodedEmail);
      copyEmailButton.setAttribute("title", decodedEmail);
    }
  }

  if ("IntersectionObserver" in window) {
    var sectionObserver = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
          }
        });
      },
      {
        threshold: 0.18,
        rootMargin: "0px 0px -10% 0px"
      }
    );

    revealElements.forEach(function (element) {
      sectionObserver.observe(element);
    });
  } else {
    revealElements.forEach(function (element) {
      element.classList.add("is-visible");
    });
  }

  function setActiveLink(sectionId) {
    navLinks.forEach(function (link) {
      var isMatch = link.getAttribute("href") === "#" + sectionId;
      link.classList.toggle("is-active", isMatch);
    });
  }

  function updateActiveLink() {
    if (!sections.length) {
      return;
    }

    var probeLine = Math.max(140, window.innerHeight * 0.24);
    var activeSection = sections[0];

    sections.forEach(function (section) {
      var rect = section.getBoundingClientRect();

      if (rect.top <= probeLine) {
        activeSection = section;
      }
    });

    var isNearPageBottom =
      window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4;

    if (isNearPageBottom) {
      activeSection = sections[sections.length - 1];
    }

    setActiveLink(activeSection.id);
  }

  navLinks.forEach(function (link) {
    link.addEventListener("click", function () {
      var href = link.getAttribute("href") || "";
      var targetId = href.replace("#", "");

      if (targetId) {
        setActiveLink(targetId);
      }

      closeMobileNav();
    });
  });

  if (copyEmailButton) {
    copyEmailButton.addEventListener("click", function (event) {
      var email = copyEmailButton.getAttribute("data-email");
      var mailtoHref = copyEmailButton.getAttribute("href") || (email ? "mailto:" + email : "");

      if (!email) {
        return;
      }

      if (navigator.clipboard && typeof navigator.clipboard.writeText === "function" && window.isSecureContext) {
        event.preventDefault();

        navigator.clipboard.writeText(email)
          .then(function () {
            var originalText = copyEmailButton.textContent;
            copyEmailButton.textContent = "E-mail zkopírován";

            window.setTimeout(function () {
              copyEmailButton.textContent = originalText;
            }, 1600);
          })
          .catch(function () {
            if (mailtoHref) {
              window.location.href = mailtoHref;
            }
          });

        return;
      }

      if (mailtoHref) {
        window.location.href = mailtoHref;
      }
    });
  }

  if (downloadPdfButton) {
    downloadPdfButton.addEventListener("click", function () {
      closeMobileNav();
      closeAvatarLightbox();

      window.setTimeout(function () {
        window.print();
      }, 80);
    });
  }

  if (mobileNavToggle && siteNav) {
    mobileNavToggle.addEventListener("click", function () {
      var isOpen = siteNav.classList.contains("is-open");

      if (isOpen) {
        closeMobileNav();
        return;
      }

      openMobileNav();
    });

    document.addEventListener("click", function (event) {
      if (!siteNav.classList.contains("is-open")) {
        return;
      }

      if (siteNav.contains(event.target) || mobileNavToggle.contains(event.target)) {
        return;
      }

      closeMobileNav();
    });
  }

  function removeAvatarClone() {
    if (activeAvatarClone) {
      activeAvatarClone.remove();
      activeAvatarClone = null;
    }
  }

  function finalizeAvatarLightboxOpen() {
    if (avatarLightboxDialog) {
      avatarLightboxDialog.classList.remove("is-preparing");
      avatarLightboxDialog.classList.remove("is-clone-active");
    }

    if (avatarLightboxClose) {
      avatarLightboxClose.focus();
    }
  }

  function createAvatarClone(targetRect) {
    if (!avatarPreviewOpen) {
      return null;
    }

    var sourceImage = avatarPreviewOpen.querySelector(".identity-card__avatar");

    if (!sourceImage) {
      return null;
    }

    var clone = document.createElement("img");
    clone.className = "image-lightbox__clone";
    clone.src = sourceImage.currentSrc || sourceImage.src;
    clone.alt = "";
    clone.style.left = targetRect.left + "px";
    clone.style.top = targetRect.top + "px";
    clone.style.width = targetRect.width + "px";
    clone.style.height = targetRect.height + "px";
    clone.style.borderRadius = "50%";
    clone.style.transformOrigin = "center center";
    document.body.appendChild(clone);
    activeAvatarClone = clone;
    return clone;
  }

  function closeAvatarLightbox() {
    if (!avatarLightbox || avatarLightbox.hidden) {
      return;
    }

    removeAvatarClone();
    avatarLightbox.classList.remove("is-open");

    if (avatarLightboxDialog) {
      avatarLightboxDialog.classList.remove("is-clone-active");
      avatarLightboxDialog.classList.add("is-preparing");
    }

    avatarLightbox.setAttribute("aria-hidden", "true");
    document.body.classList.remove("is-scroll-locked");

    window.setTimeout(function () {
      if (!avatarLightbox.classList.contains("is-open")) {
        avatarLightbox.hidden = true;
      }
    }, prefersReducedMotion.matches ? 0 : 220);

    if (lastFocusedElement && typeof lastFocusedElement.focus === "function") {
      lastFocusedElement.focus();
    }
  }

  function openAvatarLightbox() {
    if (!avatarPreviewOpen || !avatarLightbox || !avatarLightboxDialog || !avatarLightboxImage) {
      return;
    }

    lastFocusedElement = document.activeElement;
    avatarLightbox.hidden = false;
    avatarLightbox.setAttribute("aria-hidden", "false");
    avatarLightboxDialog.classList.add("is-preparing");
    avatarLightboxDialog.classList.add("is-clone-active");
    document.body.classList.add("is-scroll-locked");
    removeAvatarClone();

    var showLightbox = function () {
      avatarLightbox.classList.add("is-open");

      try {
        var sourceRect = avatarPreviewOpen.getBoundingClientRect();
        var targetRect = avatarLightboxImage.getBoundingClientRect();
        var canAnimate =
          sourceRect.width &&
          targetRect.width &&
          targetRect.height;

        if (!canAnimate) {
          finalizeAvatarLightboxOpen();
          return;
        }

        var clone = createAvatarClone(targetRect);

        if (!clone) {
          finalizeAvatarLightboxOpen();
          return;
        }

        var sourceCenterX = sourceRect.left + sourceRect.width / 2;
        var sourceCenterY = sourceRect.top + sourceRect.height / 2;
        var targetCenterX = targetRect.left + targetRect.width / 2;
        var targetCenterY = targetRect.top + targetRect.height / 2;
        var deltaX = sourceCenterX - targetCenterX;
        var deltaY = sourceCenterY - targetCenterY;
        var scaleX = sourceRect.width / targetRect.width;
        var scaleY = sourceRect.height / targetRect.height;
        var targetRadius = window.getComputedStyle(avatarLightboxDialog).borderRadius;
        var startTransform =
          "translate(" + deltaX + "px, " + deltaY + "px) scale(" + scaleX + ", " + scaleY + ") rotate(0deg)";
        var endTransform =
          "translate(0, 0) scale(1, 1) rotate(360deg)";
        var cloneAnimationDuration = 1500;

        var finishOpen = function () {
          removeAvatarClone();
          finalizeAvatarLightboxOpen();
        };

        clone.style.transition = "none";
        clone.style.transform = startTransform;
        clone.style.borderRadius = "50%";
        clone.getBoundingClientRect();

        var hasFinished = false;
        var completeOpen = function () {
          if (hasFinished) {
            return;
          }

          hasFinished = true;
          finishOpen();
        };

        clone.addEventListener("transitionend", completeOpen, { once: true });
        window.setTimeout(completeOpen, cloneAnimationDuration + 120);

        var startCloneAnimation = function () {
          clone.style.transition =
            "transform " + cloneAnimationDuration + "ms cubic-bezier(0.22, 0.04, 0.12, 1), border-radius " + cloneAnimationDuration + "ms cubic-bezier(0.22, 0.04, 0.12, 1)";
          clone.style.transform = endTransform;
          clone.style.borderRadius = targetRadius;
        };

        if (typeof window.requestAnimationFrame === "function") {
          window.requestAnimationFrame(startCloneAnimation);
        } else {
          window.setTimeout(startCloneAnimation, 16);
        }
      } catch (error) {
        removeAvatarClone();
        finalizeAvatarLightboxOpen();
      }
    };

    if (typeof window.requestAnimationFrame === "function") {
      window.requestAnimationFrame(showLightbox);
    } else {
      showLightbox();
    }
  }

  if (avatarPreviewOpen && avatarLightbox) {
    avatarPreviewOpen.addEventListener("click", openAvatarLightbox);

    if (avatarLightboxClose) {
      avatarLightboxClose.addEventListener("click", closeAvatarLightbox);
    }

    if (avatarLightboxBackdrop) {
      avatarLightboxBackdrop.addEventListener("click", closeAvatarLightbox);
    }
  }

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape") {
      closeMobileNav();
      closeAvatarLightbox();
    }
  });

  window.addEventListener("scroll", updateActiveLink, { passive: true });
  window.addEventListener("resize", function () {
    if (window.innerWidth > 1180) {
      closeMobileNav();
    }

    updateActiveLink();
  });
  updateActiveLink();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initCvPage, { once: true });
} else {
  initCvPage();
}
