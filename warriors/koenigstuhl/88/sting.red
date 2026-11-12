;redcode
;name Sting
;author John Metcalf
;strategy scanner with fixed length attack
;assert CORESIZE==8000

        step   equ 3147 ; (3*7*23)^-1 anti-imp step
        gap    equ 8

        bdist  equ 5946
        first  equ scan+step
        count  equ 7

; X<<<<<<<X<<<<
; X scanned, < negative wipe

scan    sub    inc,      ptrs
ptrs    cmp    first-gap,first
        slt    #inc+9-ptrs,ptrs
        djn    scan,     <-3892

        mov    ptrs,     wptr
        mov    #count,   c
wptr    jmp    sbmb,     #inc+1


wipe    mov    sbmb,     <wptr
        mov    sbmb,     <wptr
c       djn    wipe,     #0

        jmn    scan,     scan
sbmb    spl    0,        0
clear   mov    dbmb,     <inc
        djn    clear,    <-30
dbmb    dat    <2667,    <-5
inc     spl    <-step,   <-step

boot    mov    <wptr,    <to
        mov    <wptr,    <to
        mov    <wptr,    <to
        mov    <wptr,    <to
        djn    boot,     #4

to      djn    bdist+1,  #bdist+16

a       for    MAXLENGTH-CURLINE
        spl    a%8,      1
        rof

        end    boot

