;redcode-RFT17
;name The Rescue Team Strikes Back
;author Christian Schmidt
;strategy
;assert 1

      org    cPtr

cStep equ 1312
cOff1  equ 1522
cOff2  equ 5153

cCmp  dat    -1         , 0         ; ALTERNATIVE train check
cFang jmp    cPit-cPtr  , 0

cDat  dat    cStep      , cStep

cInc  add    cDat       , cPtr      ; 0.8c search for SB's mov-train
cPtr  sne.f  cOff1      , cOff2
      add    cDat       , cPtr
      jmn.f  cEnd       , @cPtr
      jmz.f  cInc       , *cPtr
      mov.x  cPtr       , cPtr

      seq    cCmp       , @cPtr     ; ALTERNATIVE train check
      jmp    cInc                   ; ALTERNATIVE train check


cEnd  sub.ab #2         , cPtr      ; find start of the train
      jmn.f  cEnd       , @cPtr

cChk  sub.ab #2         , cPtr      ; check if train was bombed
      jmn.f  cEnd       , @cPtr

      sub    #1601-5    , cPtr
      jmz    cInc       , @cPtr     ; check if SB is really found
      sub.ba cPtr       , cFang
      mov    cFang      , @cPtr     ; vamp SB


pStep1  equ      4965
pStep2  equ      2332
pAwa    equ      5125
pAwa2   equ      3374

      spl    2
      spl    1
      spl    1

      mov.i  <1         , {1
      jmp    pAwa      , pDat+1


cPit  spl    2
      spl    1
      spl    1

      mov.i  <1         , {1
      spl    pAwa2      , pDat+1

pNext   spl   pStep1,  {pThis
        mov   }pThis,  }pNext
        mov   pDat,    >pStep2
pThis   mov   pNext+6, }pNext
        jmz.f pNext,   *pThis
pDat    dat    <2667,       <5334

                                                                    