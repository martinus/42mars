;redcode-94x`
;name Bugtown DX 111
;author Steve Gunnell
;strategy 0.5C Bomber/Vampire switching to spiral coreclear.
;assert 1

STEP    equ  42566
BOOT    equ  23385
STARTA  equ  pit-BOOT-(STEP*23724)
STARTB  equ  (STEP*23724)
STARTC  equ  25698
GAP1    equ  0
IMP     equ  42547
IMP2    equ  (IMP+IMP)
SKIP    equ  (iclr-cptr+2)

ptr     jmp    STARTA ,STARTB
cptr    dat    STARTC ,STARTC+IMP
step    dat    -STEP  ,STEP
bomb    mov.i    #1   ,1

        for 3
        dat.f    $0      ,$0
        rof

head    mov.i  bomb   ,*ptr
place   mov.i  @0    ,@ptr
        sub.f  step   ,@place
        jmz.f  place  ,*ptr
        jmn.a  head   ,@place
                                                                                                                                           
        spl    #0    ,#0
cmov1   mov.i  iclr  ,@cptr
        mov.i  iclr  ,*cptr
cadd1   add.f  pace  ,@-1
        djn.f  cmov1 ,<cptr -2
        jmp      cmov1+1
for GAP1
        dat.f  $0    ,$0
rof
pace    dat.f  IMP2   ,IMP2
iclr    dat.f  SKIP   ,SKIP+IMP

start   mov.i  }boot1 ,>boot1
        mov.i  }boot1 ,>boot1
        mov.i  }boot1 ,>boot1
        mov.i  }boot1 ,>boot1

        mov.i  }boot2 ,>boot2
        mov.i  }boot2 ,>boot2
        mov.i  }boot2 ,>boot2
        spl.b  @boot2 ,0
        mov.i  }boot2 ,>boot2
        mov.i  }boot2 ,>boot2
        mov.i  }boot2 ,>boot2
        mov.i  }boot2 ,>boot2
        mov.i  }boot2 ,>boot2
        mov.i  }boot2 ,>boot2
        mov.i  }boot2 ,>boot2
        for 1
        mov.i  }boot2 ,>boot2
        rof

        mov.i  }boot3 ,>boot3
        mov.i  }boot3 ,>boot3
        
boot1   sub.f  #ptr   ,#ptr+BOOT
boot2   sub.f  #head  ,#head+BOOT
boot3   sub.f  #pace  ,#pace+BOOT
      for 2
		dat.f $0,$0
	  rof

        spl       #0   ,#0
        spl       #0   ,#0
pit     spl       #0   ,{0

      for MAXLENGTH-CURLINE
        spl       #0   ,#0
      rof

        end start
