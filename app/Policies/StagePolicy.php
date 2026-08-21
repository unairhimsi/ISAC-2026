<?php

namespace App\Policies;

use App\Models\Admin;
use App\Models\Stage;

class StagePolicy
{
    public function before(Admin $admin, string $ability): ?bool
    {
        return $admin->role === 'super_admin' ? true : null;
    }
    public function viewAny(Admin $admin): bool
    {
        return in_array($admin->role, ['admin_registration', 'judge'], true);
    }

    public function view(Admin $admin, Stage $stage): bool
    {
        return $this->viewAny($admin);
    }

    public function create(Admin $admin): bool
    {
        return $admin->role === 'admin_registration';
    }

    public function update(Admin $admin, Stage $stage): bool
    {
        return $this->create($admin);
    }

    public function delete(Admin $admin, Stage $stage): bool
    {
        return $this->create($admin);
    }


    public function advanceTeam(Admin $admin, Stage $stage): bool
    {
        return $admin->role === 'admin_registration';
    }
}
