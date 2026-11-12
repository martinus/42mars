;redcode
;name Suicidal Fuse
;author Christian Schmidt
;assert 1
;strategy entry #1 for RF #13
;strategy scan for counters clear, 
;strategy place the fuse and start a clear to
;strategy drive the opponent into a jmp 0


;------------------------------------
;the fuse
;------------------------------------

sSui   jmn    0,      -2

i for 7
dat -i, i
rof

;------------------------------------
;find counters clear at 0.8c 
;------------------------------------

sStep  equ    -15
sOff   equ    -200

sPtr   dat    sOff,    -sOff+200
sDec   dat    #sStep,  #-sStep

sSrch  add.f  sDec,    sPtr
       sne    *sPtr,   @sPtr
       add.f  sDec,    sPtr
       sne    *sPtr,   @sPtr
       jmp    sSrch

;------------------------------------
; found backward or forward clear?
;------------------------------------

       jmn    sFor,    *sPtr

;------------------------------------
;ok, backward-clear was found first
;adjust pointer, place and activate 
;the fuse behind the counters code
;adjust pointer for the clear
;------------------------------------

sBck   add.b  @sPtr,   sPtr
       add.ab #2,      sPtr
       mov.i  sSui,    @sPtr
       spl    >sPtr
       jmp    sClb,    >sPtr

i for 50
dat -i, i
rof

;------------------------------------
;ok, forward-clear was found first
;adjust pointer, place and activate 
;the fuse behind the counters code
;adjust pointer for the clear
;------------------------------------

sFor   add.a  *sPtr,  sPtr
       add.a  #2,     sPtr
       mov.i  sSui,   *sPtr
       spl    }sPtr
       jmp    sClb-1,    }sPtr

i for 45
dat -i, i
rof

;------------------------------------
;copy and start the backward clear
;------------------------------------
       mov.x  sPtr,   sPtr
sClb   mov.i  >sClp,  >sPtr
       mov.i  >sClp,  >sPtr
       mov.i  >sClp,  >sPtr
sClp   spl    @sPtr,  sJmp
       jmp    <sPtr

i for 50
dat -i, i
rof

;------------------------------------
;the backward clear
;------------------------------------

sJmp   jmp    #-10,  #1
sClr   mov.i  sJmp,   {sJmp
       jmp    -1,    {sJmp

end sSrch
