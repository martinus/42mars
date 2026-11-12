;redcode
;name Fool's Stone
;author Sascha Zapf
;strategy
;assert 1
; CORESIZE==2520


gate    EQU    -200

extra nop.f    <gate,        >bptr
start nop.f    }inkptr,      >bptr
      mov.i    }bptr,        }bpos
      add.f    {inkptr,      {bptr
      djn.f    <bptr,        <-100
      spl      >0,           <0
selfhit  dat   <0,           <0
bptr  dat.f    <bpos,        <start
bpos  dat.f    <selfhit+730, <0
inkptr   dat.f <inc,         <0
inc   dat.f    <729,         <730
for   5
      dat.f    <1,<1
rof

    end start
    
