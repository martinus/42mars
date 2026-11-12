;name   BludLusta
;author Philip Thorne
;strategy   IRC Round 22.
;strategy   round robin with self-fights
;strategy   pmars -b -s 2310 -p 2310 -c 23100 -l 50 -= "3-2*S" -r 2000
;strategy   points per round - win +1, loss 0, tie -1
;strategy
;strategy   Basically: Not Ties Allowd, Firemaster and Ilmari's Switcher
;assert 1
;       CORESIZE==2310
;       MAXCYCLES==23100

wA  EQU stone
wB  EQU firem

;===========================================================
;No Ties Allowed stone [Wayne Sheppard]
STEP    EQU   716

        nop   }4,         >1777-2
stone:  mov   <21,        1+STEP
        sub   1,          -1
        jmp   -2,         <-STEP

    for 3
        dat     0,        0
    rof

;===========================================================
;Fire-master one-shot [PVK]

sc      dat.f   sb,     0
db      dat.f   sb+1,   >11

firem   add.ab  #833,   sc
        jmz.f   -1,     @sc
sb      spl     #1,     >11
        mov.i   *sc,    >sc
        djn.b   -1,     <-20

;===========================================================
;noideas pbrain [Ilmari Karonen].
;
; *** switch-on-loss p-brain ***
; 5 cycles on win/tie, 6 on loss

pflag   equ     139             ; If bw'd to self will give scanner - hope
                                ; is that brain-wash most likely by paper.
num     equ     2

; pflag must not be the a-field of num-1 instructions after switch!

ilmari: ldp.ab  #pflag,     switch
        ldp.a   #0,         switch
        mod.ab  #num,       @ilmari
switch  sne.a   >0,         0
        stp.ba  switch,     ilmari
        djn.b   wA,         @ilmari  ; asymmetric if num>2

;===========================================================

        jmp     firem,      }CORESIZE/2

    end ilmari
