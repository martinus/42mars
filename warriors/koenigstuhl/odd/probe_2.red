;redcode-odd
;assert 1
;name probe 2
;author Misse

TSTEP equ 1800
CSTEP equ 3740
NSTEP equ -1922
FSTEP equ 1870
        spl     1,              <-200
        spl     1,              <-300
        mov.i   -1,             0

tim2    spl     @tim2,          }TSTEP
        mov.i   }tim2,          >tim2
cel2    spl     @cel2,          }CSTEP
        mov.i   }cel2,          >cel2
        mov.i   <-FSTEP,        {FSTEP
        mov.i   {cel2,          <ncl2
ncl2    jmp     @ncl2,          >NSTEP
