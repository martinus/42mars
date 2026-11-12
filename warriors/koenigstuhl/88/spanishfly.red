;redcode verbose
;name Spanish Fly 1.8d
;author Eric Prestemon
;strategy copy jmp 0 every XXX, then clear core with dat 0
;assert 1

offset equ 854
step   equ 76              ;(your favorite multiple of 4)

       mov data2,data2-offset
       mov split,data2-1-offset+step
       mov data,data2-offset+step
       mov loop,loop-offset
       mov lpa,lpa-offset
       mov lpb,lpb-offset
       jmp loop-offset
data2  dat #0,#step-1      ;bomb
loop   sub data2,data2-loop-step
lpa    mov @data2+step,<data2-lpa-step
lpb    jmp loop
split  jmp 0,#1
data   dat #0,#-1    ;bomb

; fill the rest with dat #0,#1324 (or spl 0,#4234 to catch progs
; that try to split into your code)
       for MAXLENGTH-CURLINE
       spl 0,#4234
       rof
