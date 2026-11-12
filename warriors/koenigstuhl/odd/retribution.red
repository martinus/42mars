;redcode-94
;name Retribution
;author Michal Janeczek
;strategy KOFACOTO Round 4 entry
;strategy Protect CIA, kill Jedimps :)
;assert 1

      org    cPtr

cFang jmp    cPit-cPtr  , 0

cDat  dat    100        , 100

cInc  add    cDat       , cPtr      ; 0.8c search for CIA's boot code
cPtr  sne.f  150        , 150+4000
      add    cDat       , cPtr
      jmn.f  cEnd       , @cPtr
      jmz.f  cInc       , *cPtr
      mov.x  cPtr       , cPtr
cEnd  add    #11        , cPtr      ; find the last instruction
      jmn.f  cEnd       , @cPtr
      jmz.f  #0         , <cPtr
      seq.a  #1190      , @cPtr     ; keep searching if found something
      jmp    cInc       , {cPtr-2   ; different

      add    #2421      , cPtr
      sub.ba cPtr       , cFang
      mov    cFang      , >cPtr     ; replace CIA's spl instruction
      mov    cPtr-2     , >cPtr     ; and remove the rest of its code
      djn    -1         , #8

fInc  add.a  #999       , fPtr      ; 0.5c scan for Jedimps
      jmz.f  fInc       , *fPtr
      jmn.f  #0         , {fPtr
      nop    }fPtr      , }fPtr
      seq.ab #-1        , *fPtr
fSrc  jmp    fInc       , fSpl+10+1

fWipe mov    fSpl+1     , }fPtr     ; stun the found copy
fCnt  djn    fWipe      , #5        ; and imp launchers of previous ones
      mov    #3         , fCnt
      sub.a  #3120+3    , fPtr
      jmn.f  fWipe      , *fPtr

      add.a  #1884+3+10 , fPtr      ; copy some spl instructions
      mov    <fSrc      , {fPtr     ; and a spiral clear behind
      djn    -1         , #5+10     ; the small Jedimp
fPtr  jmp    cPtr-10    , <cPit

cPit  jmz    #0         , #0        ; CIA sits here until the clear is copied
      jmp    *fPtr      , {cPtr-2   ; jump to the clear

fClr  add.a  #381+1     , fSpl
      mov    @fClr      , {fSpl
      jmp    fClr       , {fClr-2
      dat    -5         , {1143
fSpl  spl    #2-381     , 3

      for    MAXLENGTH-CURLINE
      spl    #1         , 1
      rof
