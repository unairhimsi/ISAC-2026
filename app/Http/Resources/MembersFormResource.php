<?php

namespace App\Http\Resources;

use App\Models\Member;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @property-read Member $resource */
class MembersFormResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $this->resource->loadMissing('photoFile');

        return [
            'id' => $this->id,
            'name' => $this->name,
            'role' => $this->role,
            'email' => $this->email,
            'major' => $this->major,
            'faculty' => $this->faculty,
            'studentId' => $this->student_id,
            'photoFileId' => $this->photo_file_id,
            'photoUrl' => $this->photoFile?->url,
            'photo' => $this->photoFile ? new FileResource($this->photoFile) : null,
            'sortOrder' => $this->sort_order,
        ];
    }
}
