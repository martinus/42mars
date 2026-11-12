;redcode-94b
;name dwarf booter
;author Rimbecano
;strategy Dwarf with tweaked stepsize, boot, and decoy.
;assert CORESIZE == 8000


dwarf   add #1364, -1
        mov -2, @-2
        jmp dwarf, -3

boot    mov -3, 3997
        mov -3, 3997
        mov -3, 3997
        jmp 3994


for 93
        dat #99, #99
rof

end boot

