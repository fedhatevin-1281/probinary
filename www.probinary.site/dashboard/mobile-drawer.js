(function () {
  function setDrawerOpen(open) {
    const drawer = document.getElementById('mobileDrawer');
    const backdrop = document.getElementById('drawerBackdrop');
    if (!drawer || !backdrop) return;

    drawer.classList.toggle('open', open);
    backdrop.style.display = open ? 'block' : 'none';
    document.body.style.overflow = open ? 'hidden' : '';
  }

  window.toggleMobileDrawer = function () {
    const drawer = document.getElementById('mobileDrawer');
    setDrawerOpen(!drawer?.classList.contains('open'));
  };

  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape') setDrawerOpen(false);
  });
})();
