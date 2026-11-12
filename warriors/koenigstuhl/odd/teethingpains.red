;redcode-odd
;name   Teething Pains
;author Philip Thorne
;strategy Vamp for IRC13. Trap/Pit untested but decays to dclear ok.
;       (CORESIZE==2520)
;assert 1

STEP    EQU     (976)
MSIZ    EQU     (8)

PTR     EQU     (fang+STEP)

;===
vamp:   mov.i   fang,               @fang
        mov.i   vbmb,               *fang
        add.f   incr,               fang
evamp:  djn     vamp,               #80
        spl     #0,                 >-9
        mov.i   vbmb,               >(vamp-9)
        djn.f   -1,                 >(vamp-9)

        dat     0,                  0
;===
  _SA   EQU     (STEP*(CORESIZE/MSIZ)/2)
fang:   jmp     *STEP-(fang-PTR)+_SA,  $-STEP-_SA
incr:   dat     #STEP,              #-STEP

    for 3
        dat     0,                  0
    rof
vbmb:   dat     <0,                 }25+10
        dat     0,                  0
        dat     0,                  0

;===
        dat     0,                  0
pit:    spl     0,                  <2
        spl     -1,                 0
        jmn     -1,                 #MAXPROCESSES
        dat     0,                  0
        dat     0,                  0
        dat     0,                  0
        dat     0,                  0
;===
        dat     0,                  0
ptr:    spl     pit-PTR,            0
boot:   mov.i   ptr,                PTR
        jmp     vamp,               {-0

    end boot
