;redcode-94x
;name Scanitator X
;author Christian Schmidt
;strategy p-warrior, stone and anti-imp paper
;assert 1

pRES    equ     #0
pSTR    equ     #111

dstep   equ     18927
dhop    equ     48530
dtime   equ     52860
dbmb    equ     (dend+4)

bStep1  EQU     52487
bStep2  EQU     45229
pStep1  EQU     657
pStep2  EQU     54430
pStep3  EQU     6719

pStart  spl     1
        spl     1
        mov     -1,     0

pap     spl     @0,     <pStep1
        mov     }-1,    >-1
        mov     }-2,    >-2
        spl     @0,     <pStep2
        mov     }-1,    >-1
        spl     @0,     <pStep3
        mov     }-1,    >-1
        mov.i   #1,     {1
        mov.i   #bStep1,<1
        djn.f   -3,     <bStep2

for 85
 dat 0,0
rof

;;;;;;;;;;;;;;;
;             ;
;    brain    ;
;             ;
;;;;;;;;;;;;;;;

think
res         ldp.ab  pRES,   #0
str         ldp.a   pSTR,   str1
            sne.ab  #0,     res
lost        add.a   #1,     str1
        mod.a   #2,     str1
win         stp.ab  str1,   pSTR
str1        jmp     @0,     dwarf
        dat     0,      pStart

for 80
 dat 0,0
rof

dwarf   mov     dend,           @dptr
        mov     {dwarf,         <dptr
        mov     {dwarf,         <dptr
dptr    mov     datb,           *16380
        mov     {dwarf,         <dptr
        mov     {dwarf,         <dptr
djmp    djn.f   @ dptr,         dptr

        dat     0,              0

        spl     #0,             <dhop+2
dloop   mov     dbmb,           {(dstep*dtime)+1
        mov     dbmb,           @dloop
        sub     #dstep,         dloop
dend    djn.f   dloop,          <dhop-2
datb    dat     <dhop+1,        >1

end think 

