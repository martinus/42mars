;redcode-94x
;name Spray 'n Wipe X 59
;author Steve Gunnell
;strategy F-scan -> hyperclear
;assert 1

IMPNUM equ 32191

ptr       dat    0          ,#15383
dat 0,0
back dat 0,0
		nop    <ptr       ,<ptr
spray   mov    *wipe      ,>ptr
for 1
          mov    *wipe      ,>ptr
rof
          jmn.f  spray      ,@ptr
scan      add.ab #14127   , ptr
          jmz.f  scan       ,>ptr
          slt.b  @scan     ,#tail-ptr+3
          jmp    back+1     ,<ptr
          add.ab #tail-ptr+4,@scan
          mov.i  comp       ,scan
          jmp    scan       ,}wipe
comp      sne.i  >ptr-scan  ,>ptr-scan
wipe      spl    #0         ,}0
          spl #0, {0
          mov.i #0 ,1
          spl #0, }0
          sub.f 1, 1
          sub.f 1, 1
tail      spl #0, {0

end scan
