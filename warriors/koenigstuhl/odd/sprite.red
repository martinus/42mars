;redcode-94ld
;name Sprite
;author Christian Schmidt
;strategy hopping f-scanner with spl/jmp and dat wipe
;strategy redcoders frenzy r-12
;assert 1

pLen  equ    (pPtr-pDat)
pPtr  equ    (pb+1)
pOff  equ    (320)

;The single process hopper copies the hole
;scanner code forwar through the core
;the dat in front is used to protect the code
;for jumping in paper's processes. 

pDat  dat    0,     0
pStrt mov    pb,    pPtr
pcopy mov    >pPtr, }pPtr
      jmn.b  -1,    pPtr
pVal  spl    pStrt+pOff

;The scanning resets its counter, because we
;don't want to wipe our copied code

decr  add.ab #4,    scn
chck  slt.b  scn,   #310
      mov.ab #10,   scn
scn   jmz.f  decr,  10

;If something is found wipe with spl/jmp
;until an empty core is detected and go back
;scanning
;After 1500 wipe-cycles switch to dat/jmp wipe
;and start another copy of the code

wipe  mov.i  bmb,   >scn
      mov.i  bmb2,  >scn
      djn    scn,   #1500
      jmp    pStrt,  }wipe

;That are the bombs and the copy pointer

bmb2  jmp    -1,    1
bmb   spl    #1,    1
pb    dat    pDat+pOff-pPtr, -pLen

      end pStrt
