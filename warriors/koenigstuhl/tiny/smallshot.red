;redcode-tiny
;name SmallShot
;author Roy van Rijn
;strategy Oneshot, also works on 94nop
;strategy With some other steps ofcourse..
;assert 1

cStep       equ     771
cOff        equ     3410

cAdd        add.f   cIncr,   cScan
cScan       sne.i   cOff,    cOff+8
            djn.f   cAdd,    @cScan

cIncr       spl.f   #-cStep, <-cStep
            mov.i   @cBomb,  }cScan
            djn.f   -1,      <cScan
cBomb       dat     #8,      }1
            spl     #7,      {5960

end cScan

