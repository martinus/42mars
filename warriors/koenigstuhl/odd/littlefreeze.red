;redcode-94
;name Little Freeze
;author David Houston <Hurkyl@msn.com>
;assert 1

first equ 65
inc equ 65
gate equ ptr-10


head:   dat 0, 0
        dat 0, 0
        dat 0, 0
        dat 0, 0
        dat 0, 0
jmpb:   jmp -1, 0
ptr:    mov jmpb, first + morph
        add.ab #inc - 1, ptr
start:  mov splb, >ptr
morph:  djn.f -3, <gate
        mov *wipe, <wipe
        djn.f -1, gate
        dat -4, morph - 1 - wipe
        spl #-4, morph - 1 - wipe
splb:   spl #-3, <gate - morph
        dat 0, 0
wipe:   dat -2, head - 21
        dat 0, 0
        dat 0, 0
        dat 0, 0

org start
