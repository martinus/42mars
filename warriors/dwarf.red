;redcode-94
;name Dwarf
;author A. K. Dewdney
;strategy Drops a DAT bomb on every fourth cell, forever.
;assert CORESIZE % 4 == 0
bomb    dat     #0
dwarf   add     #4, bomb
        mov     bomb, @bomb
        jmp     dwarf
        end     dwarf
