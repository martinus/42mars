;redcode-94
;name Hyperclear
;author Steve Gunnell
;strategy Fast scan and clear
;assert 1
; KOFACOTO-1

for 0
I had not intended to publish this yet as (for some constants) it is
the only thing I have that will consistantly trash Styalised Euphoria.
*sigh*
rof

ptr       dat    #0         ,#100
back      jmn.f  #0         ,<ptr
spray     mov    *wipe      ,>ptr
for 4
          mov    *wipe      ,>ptr
rof
          jmn.f  spray      ,@ptr
scan      add.ab #873   , ptr
          jmz.f  scan       ,>ptr
          slt.b  @scan     ,#tail-ptr+3
          jmp    back       ,<ptr
          add.ab #tail-ptr+4,@scan
          mov.i  comp       ,scan
          jmp    scan       ,}wipe
comp      sne.i  >ptr-scan  ,>ptr-scan
wipe      spl #0, }0
          spl #0, }0
          spl #0, }0
          spl #0, }0
          dat >2286, >1143
          dat >2286, >1143
tail      dat >2286, >1143

end scan 

