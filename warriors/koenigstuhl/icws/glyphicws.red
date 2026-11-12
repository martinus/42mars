;redcode-icws
;name Glyph T
;author John Metcalf
;strategy .66c scanner with a fixed length attack
;assert CORESIZE==8192

        step   equ 2157 ; (3*7*17)^-1 anti-imp step
        gap    equ 9
        time   equ 6764 ; -4*step^-1

        bdist  equ 7432
        first  equ scan+step
        count  equ 10

; <X<<<<<<<<X<<<<<<<<<
; X scanned, < negative wipe

; The scan phase is timed to end so the
; final SPL carpet hits clear-1 and t to
; switch to the endgame.

scan    sub    inc,      ptrs
ptrs    cmp    first-gap,first
        slt    #sbmb+9-ptrs,ptrs
t       djn    scan,     #time

        mov    ptrs,     cptr
        mov    #count,   c

clear   mov    @bptr,    <cptr
        mov    @bptr,    <cptr
c       djn    clear,    #0

        djn    scan,     t
bptr    djn    clear-1,  #sbmb

cptr    dat              #sbmb+1
inc     spl    <-step,   <-step
dbmb    dat    <2731,    #-6
sbmb    spl    0,        1

boot    mov    <cptr,    <to
        mov    <cptr,    <to
        mov    <cptr,    <to
        mov    <cptr,    <to
        mov    <cptr,    <to
        djn    boot,     #3

to      djn    bdist+1,  #bdist+15

a       for    MAXLENGTH-CURLINE
        spl    a%9,      1
        rof

        end    boot

