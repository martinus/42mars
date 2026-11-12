;redcode-94x
;name Humpty IRC5
;author Philip Thorne
;assert 1
; (CORESIZE==800) && (MAXLENGTH==20)

DOFF    EQU     (-20)
SOFF    EQU     STEP+2
STEP    EQU     234


stone:  spl     #A,         #B
chuck:  mov.i   bmb,        *SOFF
norris: mov.i   tbmb,       @-1
        add.ab  #STEP,      chuck
        djn.f   @-1,        DOFF
        mov.i   #1,         1
tbmb:   dat     13,         1
bmb:    mov     -5,         -1

    end
