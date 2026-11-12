;redcode-94
;author David Houston
;name Walker, Texas Ranger
;strategy walking dat clear
;assert 1

count   equ     7
offset  equ     33

cptr:   dat     0, offset
        mov.ab  #count, 2
        mov.i   }cptr, >cptr
        djn.b   -1, #0
        spl     cptr + offset + 1, -5
        mov     cptr, <-1
        jmp     -1

        end     cptr + 1
