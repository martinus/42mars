;redcode-rft21
;name 1. FSV Mainz 05
;author Christian Schmidt
;strategy this is my first entry for the
;strategy RFT21
;assert 1

value equ 3456  ; just for Koenigstuhl [CCB]

goal equ value
ball equ value

STEP   equ     5266
INIT   equ     (sbmb+STEP)
bOff   equ     100

;______________________________________________
;      here is a fake ball. Good against teams |
;      which didn't verify the ball            |

bFake  jmp     #0,         #ball       ;scanned

;______________________________________________|


for 10
       dat     0,          0
       dat     0,          0           ;scanned
rof

;___________find the opponent team_____________
;jmz-scanner with 3 zero a-fields. This will   |
;make it hopefully invisible enough if the     |
;opponents team is searching for me.           |
;The scanning pattern is optimized to scan     |
;every second location, so I will definately   |
;find the opponents team                       |

;      stun the opponent with this bomb        |

sptr   jmp     #STEP,      #INIT

;      code snipped ala carbonite-stone        |
;      for a zero a-field                      |

sadd   add.ab  {0,         }0          ;scanned

;      scan for a non-zero a-field. Ball and   |
;      goals will be invisible then, but the   |
;      opponents team should be visible enought|
;      to find him quickly                     |

scan   jmz.a   sadd,       @sptr

;      if something is found stun it           |

sbmb   mov     @0,         @sptr       ;scanned

;      two stuns seems enough to paralyze the  |
;      opponents team                          |

schk   djn     sadd,       #2

;      After paralyzing the opponents team     |
;      start searching the ball                |

       jmp     @0,         bScan       ;scanned
;______________________________________________|


for 10
       dat     0,          0
       dat     0,          0           ;scanned
rof


;_________________find the ball________________
;search for the ball and vamp the balls process|
;to a safe place. Verify that I really get the |
;process otherwise it was a fake ball and I go |
;on searching for the ball.                    |
;Zero a-fields in alternating order to prevent |
;self-scans.                                   |

;      linear scanning b-field vamp scanner    |

bScan  sne.ab  #ball,      @bVamp

;      found the ball                          |

       jmp     @0,         bCatch      ;scanned

;      scanning loop                           |

       add.f   bPtr,       bVamp
       jmp     @0,         bScan       ;scanned

;      copy the vamp bomb to catch the balls   |
;      process                                 |

bCatch mov.i   bVamp,      @bVamp

;      Wait instruction to give the balls      |
;      process enough time to varify itself    |

       nop     0,          0           ;scanned

;      Check if I got the balls process. If    |
;      it fails go on with scanning            |

       jmz.b   bScan,      bCheck

;      Ok, got the ball! Go searching the goal |

       jmp     @0,         gScan       ;scanned
;______________________________________________|


for 10
       dat     0,          0
       dat     0,          0           ;scanned
rof


;________________find the goal_________________
;Searching for the goal with a basic linear    |
;scanner. The gScan's b-field is the pointer   |
;for shooting the ball into the goal           |

gScan  sne.ab  #goal,      bFake-100
       jmp     @0,         bShot       ;scanned
       jmp     gScan,      <gScan

;      here is another fake ball               |

       dat     0,          #ball       ;scanned

;______________________________________________|


for 5
       dat     0,          0
       dat     0,          0           ;scanned
rof


;_________________shoot!!!!!___________________
;Shoot the ball into the goal and wait for the |
;win                                           |

bShot  mov.i   bGoal,      bPit
bCheck jmp     #0,         0           ;scanned
;______________________________________________|


;__________________misc code___________________
;Here are some pieces which are needed for my  |
;team                                          |

;      This is the vamp bomb to catch the balls|
;      process                                 |

bVamp  jmp  (2*bPit)-bScan+bOff,bScan-bPit-bOff

;      This is the pit where the balls process |
;      is stored until the goal is found       |

bPit   jmp     #0,         <bCheck     ;scanned
bPtr   dat     1,          -1

;      here is another fake ball               |

       dat     0,          #ball       ;scanned

;      This is needed to shoot the ball into   |
;      the goal                                |

bGoal  mov.i   1,          @gScan-bPit
;______________________________________________|

       end     scan

