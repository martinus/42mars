;redcode-NW
;name Nanomaster of the Wins
;author Christian Schmidt
;strategy Nano adaption of Master of the Wins
;strategy with a djn-train instead of stone
;strategy means it can't win against any warrior using spl #0
;strategy optimax fsh94nop0.3 topscore is 68.22
;strategy weak against any kind of scanner
;strategy but surprising wins against a few papers
;strategy might work ok on the ICL 2012, so let's see
;assert 1

;optimax 1234
;optimax work nano-master2
;optimax rounds 1 100 200 200
;optimax suite fsh94nop0.3

;optimax phase2 fsh94nop0.3/scn/hsa.red
;optimax phase2 60

;optimax phase3 top20
;optimax phase3 cds:scn:clr
;optimax phase3 60

;optimax phase4 top20
;optimax phase4 100%

bStart  equ     7137
bStep   equ     4059
bBmb1	equ     5962
bBmb2	equ     2417
tStart  equ     6060

bptr    spl     bStart,  {bBmb1
boot    mov.i   stream,  }bptr
        add.a   #bStep,  bptr
        djn.f   bptr,    {bBmb2
stream  djn.f   #tStart, {0

