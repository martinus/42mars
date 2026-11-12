;redcode-94lp
;assert 1
;name LP-mHSA
;author Lukasz Grabun

 STEP equ 451
 GAP  equ  1
 BPTR equ (top-GAP-1)
top:

sptr mov.ab #0    ,BPTR
wipe mov.i  bomb  ,>BPTR
for GAP
     mov.i  *wipe ,>BPTR
rof
     jmn.f  wipe  ,@BPTR
scan add.a  #STEP ,sptr
     jmz.f  scan  ,*sptr
     slt.ab sptr  ,#tail-top+3
     jmp    sptr
     jmn.a  scan  ,sptr
     jmp    scan  ,}wipe
bomb jmp    #0    ,}0
     nop    0     ,0
tail dat.f  0     ,0
end scan
