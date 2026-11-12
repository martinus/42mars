# Koenigstuhl warriors

The warriors of the [Koenigstuhl](https://asdflkj.net/COREWAR/koenigstuhl.html) hills, archive hills on which a warrior stays once it was submitted. Downloaded on 12th November 2026 from the archives linked on that page.

These warriors have no license. Each file is as its author submitted it to the hill; the author is in its `;author` line. They are here as test material for the assembler and the simulator, not as part of 42mars, and the MIT license of this repository does not cover them.

| Folder | Warriors | Archive | pMARS options of the hill |
|---|---|---|---|
| `88/` | 683 | `88/88.tar.gz` | `-8 -r 1000` |
| `94nop/` | 1107 | `94/94.tar.gz` | `-r 1000`, no p-space |
| `pspace-top50/` | 53 | `PSPACE/TOP50/psptop50.tar.gz` | `-r 1000`, p-space allowed; the top 50 of the hill (the link to the whole hill gave an HTML page) |
| `lp/` | 149 | `LP/lp.tar.gz` | `-r 1000 -p 8 -l 200 -d 200` |
| `icws/` | 482 | `ICWS/icws.tar.gz` | `-r 1000 -8 -s 8192 -p 8000 -c 100000` |
| `icws64/` | 475 | `ICWS64/icws64.tar.gz` | `-r 1000 -8 -s 8192 -p 64` |
| `x/` | 214 | `X/x.tar.gz` | `-r 1000 -s 55440 -c 500000 -p 10000 -l 200 -d 200` |
| `tiny/` | 436 | `TINY/tiny.tar.gz` | `-P -s 800 -c 8000 -l 20 -d 20 -p 800` |
| `nano/` | 499 | `NANO/nano.tar.gz` | `-P -s 80 -c 800 -l 5 -d 5 -p 80` |
| `odd/` | 1163 | `ODD/odd.tar.gz` | `-r 100 -l 800 -d 800`, warriors of the '88, '94 and p-space rules that fit no other hill |

The archives are relative to `https://asdflkj.net/COREWAR/`. Each folder holds the `.red` files of its archive's one folder (`HILL32/`, for `icws64` `HILL/`), flattened. Left out: the macOS metadata files `._*.red` in the archives of `88`, `94` and `nano` (21, 71 and 34 of them, not Redcode), and the TOP-50 archives of the '88 and '94nop hills, whose 59 and 60 warriors are the same files as in `88/` and `94nop/`.

SHA-256 of the archives as downloaded:

```
dbd85b671f1f1f18fe341b06d158556320b61c448428c0552efcbaadf976b21d  88.tar.gz
ecebc38d517198da9aea1053d018a2c9183581b07f81da787664a82fe0eee5d3  94.tar.gz
f0c9796ef0f00ef2f907c5ad12fa506932680223981bb9b56136d95918756fc1  psptop50.tar.gz
68b8868ae31a3d95005ecfd29b666078d866ff97ce75ec837d022f8693536a2f  lp.tar.gz
66419ae1ef450ff0be6e064541ca55bbbbddf0fcb9d45c00c9003d029c715354  icws.tar.gz
fb9e9521f782bfab6362c053733860b6dea3059e700a2c047bf3f10b1b556682  icws64.tar.gz
74dcb47dc42a6f38960c3076ce37042302081a96e5c215010515ff70a4a3f17d  x.tar.gz
2a692dab0fb1b26bc91bc9838e15b4de63b640a35210367db8ae480a800aabdc  tiny.tar.gz
4bf2b5c6f3ef810da49bfac12e2051427af40a2a246cc65befb07dbd79beb36d  nano.tar.gz
6c186fb69ca85e8274fad0c566090f497509c498c57b0a8b9a23f15ba2b9430e  odd.tar.gz
```
