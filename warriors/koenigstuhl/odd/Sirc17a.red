;redcode
;name S:IRC17a
;author Philip Thorne
;       CORESIZE==2520
;assert 1

SSTEP   EQU     193
SSOFF   EQU     SSTEP
DSTEP   EQU     631
DSOFF   EQU     (DSTEP+2)
DBOOT   EQU     (static-(SSTEP*5))

static: mov.i   bmb,        >sptr
        add.ab  #SSTEP,     sptr
sptr:   jmp     -2,         #SSOFF
bmb:    dat     #1,         #1

    for 15
        dat     0,          0
    rof

boot:   spl     static,     dptr+DBOOT+3

        mov.i   <dboot,     {dboot
        mov.i   <dboot,     {dboot
        mov.i   <dboot,     {dboot
dboot:  jmp     dptr+DBOOT+1, dptr+1

    for 2
        dat     0,          0
    rof

dyn:    mov.i   bmb-DBOOT,  >dptr
        add.ab  #DSTEP,     dptr
dptr:   jmp     -2,         #DSOFF

  end boot

